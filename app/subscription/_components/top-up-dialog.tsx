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
  loadCloudPaymentsScript,
} from "@/lib/payments/cloudpayments-widget";
import type { PaymentStatusResponse, TopupIntentResponse } from "@/lib/types";
import styles from "./top-up.module.css";
import {
  buildStatusUrl,
  checkStatusOnce,
  endOfPolling,
  type PollResult,
  readStatusResponse,
  stageFromPollResult,
  type TopupStage,
  unconfirmedStage,
} from "./top-up-poll-outcome";
import {
  TopupAmountStage,
  TopupDeclined,
  TopupProcessing,
  TopupSuccess,
} from "./top-up-stages";
import { TopupUnconfirmed } from "./top-up-unconfirmed";
import { useTopupAmount } from "./use-topup-amount";

const DEFAULT_AMOUNT_MAJOR = 1000;
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 60;

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

  const applyPollResult = useCallback(
    (result: PollResult, sessionId: string, amountMajor: number) => {
      if (result.kind === "succeeded") {
        // Re-render the server page so the hero pools update behind us.
        router.refresh();
      }
      const nextStage = stageFromPollResult(result, { sessionId, amountMajor });
      if (nextStage) {
        setStage(nextStage);
      }
    },
    [router]
  );

  const pollStatus = useCallback(
    async (paymentSessionId: string, amountMajor: number) => {
      stopPolling();
      const controller = new AbortController();
      abortRef.current = controller;
      const { signal } = controller;
      let hasReachedServer = false;

      for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
        if (signal.aborted) {
          return;
        }

        try {
          const res = await fetch(buildStatusUrl(paymentSessionId), {
            signal,
          });

          if (res.status === 429) {
            // Shared per-IP limiter — back off a little harder.
            await delay(POLL_INTERVAL_MS * 2, signal);
            continue;
          }

          if (res.ok) {
            hasReachedServer = true;
            const data: PaymentStatusResponse = await res.json();
            const result = readStatusResponse(data);

            if (result) {
              applyPollResult(result, paymentSessionId, amountMajor);
              return;
            }
          }
        } catch {
          // A network error is retried; if none succeeds the user sees
          // the "could not reach the server" screen.
          if (signal.aborted) {
            return;
          }
        }

        await delay(POLL_INTERVAL_MS, signal);
      }

      applyPollResult(
        endOfPolling({ isAborted: signal.aborted, hasReachedServer }),
        paymentSessionId,
        amountMajor
      );
    },
    [applyPollResult, stopPolling]
  );

  const handleSubmit = useCallback(async () => {
    if (!amount.isValid) {
      return;
    }

    const userId = session?.user?.id;
    const email = session?.user?.email;
    const publicId = process.env.NEXT_PUBLIC_CLOUDPAYMENTS_PUBLIC_ID;

    if (!(userId && email && publicId)) {
      setSubmitError(t("createError"));
      return;
    }

    setSubmitError(null);
    setStage({ name: "amount", isSubmitting: true });

    try {
      await loadCloudPaymentsScript();

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
              setStage(
                unconfirmedStage(
                  { sessionId: intent.sessionId, amountMajor },
                  "unreachable"
                )
              );
            });
          },
          onFail: () => {
            // The widget reports a declined charge: nothing was paid.
            resolvedRef.current = true;
            setStage({ name: "declined", amountMajor });
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

  /**
   * «Не ждать» on the waiting screen. Once the widget has reported a payment,
   * stopping the wait must not look like a cancellation: show the
   * "not confirmed yet" guidance instead of closing.
   */
  const handleStopWaiting = useCallback(() => {
    if (!(stage.name === "processing" && resolvedRef.current)) {
      closeDialog();
      return;
    }
    stopPolling();
    setStage(unconfirmedStage(stage, "stoppedWaiting"));
  }, [stage, closeDialog, stopPolling]);

  const handleRecheck = useCallback(async () => {
    if (stage.name !== "unconfirmed") {
      return;
    }
    stopPolling();
    const controller = new AbortController();
    abortRef.current = controller;
    setStage({ ...stage, isChecking: true });
    // The balance on the page behind the dialog may have changed meanwhile.
    router.refresh();
    const result = await checkStatusOnce(stage.sessionId, controller.signal);
    // Closed while checking: the dialog has already been reset.
    if (controller.signal.aborted) {
      return;
    }
    if (result.kind === "unconfirmed") {
      setStage(unconfirmedStage(stage, result.cause, true));
      return;
    }
    applyPollResult(result, stage.sessionId, stage.amountMajor);
  }, [stage, router, applyPollResult, stopPolling]);

  const stageTitleKeys: Record<TopupStage["name"], string> = {
    amount: "title",
    processing: "processing.title",
    success: "success.title",
    declined: "declined.title",
    unconfirmed: "unconfirmed.title",
  };
  const stageTitle = t(stageTitleKeys[stage.name]);

  const contentClass = isMobile
    ? "top-auto bottom-0 left-0 w-full max-w-none translate-x-0 translate-y-0 rounded-t-[20px] rounded-b-none data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom"
    : "w-[432px] max-w-[calc(100vw-2rem)]";

  return (
    <Dialog onOpenChange={handleOpenChange} open={isOpen}>
      <DialogContent aria-describedby={undefined} className={contentClass}>
        <DialogTitle className="sr-only">{stageTitle}</DialogTitle>
        <div className={`${styles.body} ${isMobile ? styles.bodySheet : ""}`}>
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
              onStopWaiting={handleStopWaiting}
            />
          )}

          {stage.name === "success" && (
            <TopupSuccess
              amountMajor={stage.amountMajor}
              balanceTotalMinor={stage.balanceTotalMinor}
              onDone={closeDialog}
            />
          )}

          {stage.name === "declined" && (
            <TopupDeclined
              amountMajor={stage.amountMajor}
              onClose={closeDialog}
              onRetry={handleRetry}
            />
          )}

          {stage.name === "unconfirmed" && (
            <TopupUnconfirmed
              amountMajor={stage.amountMajor}
              cause={stage.cause}
              hasRechecked={stage.hasRechecked}
              isChecking={stage.isChecking}
              onClose={closeDialog}
              onRecheck={handleRecheck}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
