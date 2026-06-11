"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTranslations } from "@/lib/i18n/translate";
import {
  buildReceipt,
  createWidgetOptions,
} from "@/lib/payments/cloudpayments-widget";
import type { PaymentStatusResponse, TopupIntentResponse } from "@/lib/types";
import styles from "./top-up.module.css";
import {
  TopupAmountStage,
  TopupFailed,
  TopupProcessing,
  TopupSuccess,
} from "./top-up-stages";
import { useTopupAmount } from "./use-topup-amount";

const DEFAULT_AMOUNT_MAJOR = 1000;
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 60;

type TopupStage =
  | { name: "amount"; isSubmitting: boolean }
  | { name: "processing"; sessionId: string; amountMajor: number }
  | { name: "success"; amountMajor: number; balanceTotalMinor: number }
  | { name: "failed"; amountMajor: number; reason: string | null };

type TopUpDialogProps = {
  isOpen: boolean;
  /** Lower bound in MAJOR units; lowered for testers (matches the server). */
  minAmountMajor: number;
  onOpenChange: (open: boolean) => void;
};

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true }
    );
  });
}

export function TopUpDialog({
  isOpen,
  minAmountMajor,
  onOpenChange,
}: TopUpDialogProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const isMobile = useIsMobile();
  const t = useTranslations("auth.subscription.balance.topup");

  const amount = useTopupAmount(DEFAULT_AMOUNT_MAJOR, minAmountMajor);
  const [stage, setStage] = useState<TopupStage>({
    name: "amount",
    isSubmitting: false,
  });
  const [submitError, setSubmitError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  // Set once the widget outcome is known (success polling started or failed).
  // Prevents onComplete — which also fires after success/fail — from
  // downgrading the stage back to "amount".
  const resolvedRef = useRef(false);

  const stopPolling = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  const resetFlow = useCallback(() => {
    stopPolling();
    resolvedRef.current = false;
    setSubmitError(null);
    setStage({ name: "amount", isSubmitting: false });
    amount.set(DEFAULT_AMOUNT_MAJOR);
  }, [stopPolling, amount]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        resetFlow();
      }
      onOpenChange(open);
    },
    [onOpenChange, resetFlow]
  );

  const closeDialog = useCallback(
    () => handleOpenChange(false),
    [handleOpenChange]
  );

  const pollStatus = useCallback(
    async (paymentSessionId: string, amountMajor: number) => {
      stopPolling();
      const controller = new AbortController();
      abortRef.current = controller;
      const { signal } = controller;

      for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
        if (signal.aborted) {
          return;
        }

        try {
          const res = await fetch(
            `/api/payment/status?sessionId=${encodeURIComponent(paymentSessionId)}`,
            { signal }
          );

          if (res.status === 429) {
            // Shared per-IP limiter — back off a little harder.
            await delay(POLL_INTERVAL_MS * 2, signal);
            continue;
          }

          if (res.ok) {
            const data: PaymentStatusResponse = await res.json();

            if (data.status === "succeeded") {
              // Re-render the server page so the hero pools update behind us.
              router.refresh();
              setStage({
                name: "success",
                amountMajor,
                balanceTotalMinor: data.topup?.balanceTotalMinor ?? 0,
              });
              return;
            }

            if (data.status === "failed" || data.status === "expired") {
              setStage({
                name: "failed",
                amountMajor,
                reason: data.failureReason ?? null,
              });
              return;
            }
          }
        } catch {
          if (signal.aborted) {
            return;
          }
        }

        await delay(POLL_INTERVAL_MS, signal);
      }

      if (!signal.aborted) {
        setStage({ name: "failed", amountMajor, reason: null });
      }
    },
    [router, stopPolling]
  );

  const handleSubmit = useCallback(async () => {
    if (!amount.isValid) {
      return;
    }

    const userId = session?.user?.id;
    const email = session?.user?.email;
    const publicId = process.env.NEXT_PUBLIC_CLOUDPAYMENTS_PUBLIC_ID;

    if (!(userId && email && publicId) || typeof window.cp === "undefined") {
      setSubmitError(t("createError"));
      return;
    }

    setSubmitError(null);
    setStage({ name: "amount", isSubmitting: true });

    try {
      const res = await fetch("/api/topup/create-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amount.value }),
      });

      if (!res.ok) {
        throw new Error("Failed to create top-up intent");
      }

      const intent: TopupIntentResponse = await res.json();
      const amountMajor = amount.value;
      const receipt = buildReceipt(t("title"), amountMajor, email);
      const widget = new window.cp.CloudPayments(createWidgetOptions(email));

      resolvedRef.current = false;

      widget.pay(
        "charge",
        {
          publicId,
          description: t("title"),
          amount: amountMajor,
          currency: "RUB",
          accountId: userId,
          email,
          skin: "classic",
          data: {
            kind: "topup",
            sessionId: intent.sessionId,
            CloudPayments: { CustomerReceipt: receipt },
          },
        },
        {
          onSuccess: () => {
            resolvedRef.current = true;
            pollStatus(intent.sessionId, amountMajor).catch(() => {
              setStage({ name: "failed", amountMajor, reason: null });
            });
          },
          onFail: (reason) => {
            resolvedRef.current = true;
            setStage({
              name: "failed",
              amountMajor,
              reason: typeof reason === "string" ? reason : null,
            });
          },
          onComplete: (paymentResult) => {
            // The user closed the widget without paying — return to the
            // amount stage. The pending intent expires server-side.
            if (!(paymentResult?.success || resolvedRef.current)) {
              setStage({ name: "amount", isSubmitting: false });
            }
          },
        }
      );

      setStage({
        name: "processing",
        sessionId: intent.sessionId,
        amountMajor,
      });
    } catch {
      setSubmitError(t("createError"));
      setStage({ name: "amount", isSubmitting: false });
    }
  }, [amount, session, t, pollStatus]);

  const handleRetry = useCallback(() => {
    stopPolling();
    resolvedRef.current = false;
    setStage({ name: "amount", isSubmitting: false });
  }, [stopPolling]);

  const stageTitle =
    stage.name === "processing"
      ? t("processing.title")
      : stage.name === "success"
        ? t("success.title")
        : stage.name === "failed"
          ? t("failed.title")
          : t("title");

  const contentClass = isMobile
    ? "top-auto bottom-0 left-0 w-full max-w-none translate-x-0 translate-y-0 rounded-t-[20px] rounded-b-none data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom"
    : "w-[432px] max-w-[calc(100vw-2rem)]";

  return (
    <Dialog onOpenChange={handleOpenChange} open={isOpen}>
      <DialogContent aria-describedby={undefined} className={contentClass}>
        <DialogTitle className="sr-only">{stageTitle}</DialogTitle>
        <div className={`${styles.body} ${isMobile ? styles.bodySheet : ""}`}>
          {isMobile && <div className={styles.grab} />}

          {stage.name === "amount" && (
            <TopupAmountStage
              amount={amount}
              isSubmitting={stage.isSubmitting}
              minAmountMajor={minAmountMajor}
              onClose={closeDialog}
              onSubmit={handleSubmit}
              submitError={submitError}
            />
          )}

          {stage.name === "processing" && (
            <TopupProcessing
              amountMajor={stage.amountMajor}
              onCancel={closeDialog}
            />
          )}

          {stage.name === "success" && (
            <TopupSuccess
              amountMajor={stage.amountMajor}
              balanceTotalMinor={stage.balanceTotalMinor}
              onDone={closeDialog}
            />
          )}

          {stage.name === "failed" && (
            <TopupFailed
              amountMajor={stage.amountMajor}
              onClose={closeDialog}
              onRetry={handleRetry}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
