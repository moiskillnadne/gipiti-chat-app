"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useReducer, useRef } from "react";
import type { Locale } from "@/i18n/config";
import { clientLog } from "@/lib/client-logger";
import type { CloudPaymentsWidget } from "@/lib/payments/cloudpayments-types";
import type { PaymentIntentResponse, PaymentStatusResponse } from "@/lib/types";
import { toast } from "../../../../components/toast";
import {
  buildReceipt,
  buildReturnUrl,
  clearPaymentSession,
  createWidgetOptions,
  getAmount,
  getCurrency,
  getPlanDisplayName,
  getRecurrentConfig,
  getStoredPaymentSession,
  isPaymentSessionExpired,
  storePaymentSession,
  storeWidgetOpened,
} from "../utils/payment-utils";
import {
  createInitialState,
  type PaymentState,
  type PlanType,
  paymentReducer,
} from "./payment-reducer";

export type UsePaymentOptions = {
  isTester: boolean;
};

export type UsePaymentReturn = {
  state: PaymentState;
  subscribe: (plan: PlanType) => Promise<void>;
  startTrial: (plan: PlanType) => Promise<void>;
  reset: () => void;
};

export function usePayment(options: UsePaymentOptions): UsePaymentReturn {
  const { isTester } = options;
  const t = useTranslations("auth.subscription");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const {
    data: session,
    update: updateSession,
    status: sessionStatus,
  } = useSession();

  const [state, dispatch] = useReducer(
    paymentReducer,
    isTester,
    createInitialState
  );

  // Polling guard to prevent concurrent polling loops
  const isPollingRef = useRef(false);

  const handleSessionUpdate = useCallback(async () => {
    await updateSession({ hasActiveSubscription: true });
    // Redirect directly to chat instead of relying on middleware
    router.replace("/chat");
  }, [updateSession, router]);

  // Poll payment status using the payment intent system
  const pollPaymentStatus = useCallback(
    async (sessionId: string, maxRetries = 60, abortSignal?: AbortSignal) => {
      // Guard against concurrent polling
      if (isPollingRef.current) {
        clientLog.info("[Payment] Polling already in progress, skipping", {
          sessionId,
        });
        return;
      }

      isPollingRef.current = true;

      try {
        dispatch({ type: "SET_STATUS", status: "verifying" });

        for (let i = 0; i < maxRetries; i++) {
          // Check if polling was aborted
          if (abortSignal?.aborted) {
            clientLog.info("[Payment] Polling aborted");
            return;
          }

          // Check if session expired before polling
          const { expiresAt } = getStoredPaymentSession();
          if (isPaymentSessionExpired(expiresAt)) {
            dispatch({ type: "SET_STATUS", status: "expired" });
            dispatch({
              type: "PAYMENT_FAILED",
              error: "Payment session expired",
            });
            clearPaymentSession();
            return;
          }

          try {
            const res = await fetch(
              `/api/payment/status?sessionId=${encodeURIComponent(sessionId)}`,
              { signal: abortSignal }
            );

            if (!res.ok) {
              if (res.status === 429) {
                // Rate limited, wait longer
                await new Promise((resolve) => setTimeout(resolve, 2000));
                continue;
              }
              throw new Error("Failed to fetch payment status");
            }

            const data: PaymentStatusResponse = await res.json();

            // Always update status
            dispatch({ type: "SET_STATUS", status: data.status });

            if (data.status === "succeeded") {
              dispatch({ type: "SET_STATUS", status: "activating" });
              await new Promise((resolve) => setTimeout(resolve, 500));

              dispatch({ type: "PAYMENT_SUCCEEDED" });
              toast({ type: "success", description: t("success") });

              clearPaymentSession();

              await new Promise((resolve) => setTimeout(resolve, 500));
              await handleSessionUpdate();
              return;
            }

            if (data.status === "failed" || data.status === "expired") {
              dispatch({
                type: "PAYMENT_FAILED",
                error: data.failureReason ?? null,
              });
              toast({ type: "error", description: t("error") });
              clearPaymentSession();
              return;
            }
          } catch (error) {
            // Ignore abort errors
            if (error instanceof Error && error.name === "AbortError") {
              clientLog.info("[Payment] Fetch aborted");
              return;
            }
            console.error("Polling error:", error);
          }

          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        // Timeout: show error with retry option
        dispatch({ type: "PAYMENT_FAILED", error: t("error") });
      } finally {
        isPollingRef.current = false;
      }
    },
    [t, handleSessionUpdate]
  );

  // Store latest pollPaymentStatus ref to avoid useEffect re-triggers
  const pollPaymentStatusRef = useRef(pollPaymentStatus);
  pollPaymentStatusRef.current = pollPaymentStatus;

  // Check for existing payment session on mount (redirect recovery)
  useEffect(() => {
    const abortController = new AbortController();

    clientLog.info("[Payment] Check existing session on mount", {
      session,
      sessionStatus,
    });

    const checkExistingSession = async () => {
      // Check URL params first (CloudPayments callback may add it)
      const urlParams = new URLSearchParams(window.location.search);
      let sessionId = urlParams.get("sessionId");

      // Fallback to localStorage
      if (!sessionId) {
        clientLog.info("[Payment] No sessionId in url params");
        const stored = getStoredPaymentSession();
        sessionId = stored.sessionId;
      }

      if (!sessionId) {
        clientLog.info("[Payment] No sessionId in localStorage");
        return;
      }

      clientLog.info("[Payment] SessionId found", { sessionId });

      // Check expiration
      const { expiresAt, plan, widgetOpened } = getStoredPaymentSession();
      if (isPaymentSessionExpired(expiresAt)) {
        clientLog.info("[Payment] Session expired, clearing");
        clearPaymentSession();
        return;
      }

      // CRITICAL CHECK: If widget was never opened (user refreshed before widget.pay()),
      // this is a stale session from an incomplete payment flow. Clear it.
      if (!widgetOpened) {
        clientLog.info(
          "[Payment] Widget never opened - user refreshed before widget loaded. Clearing stale session.",
          { sessionId }
        );
        clearPaymentSession();
        return;
      }

      clientLog.info(
        "[Payment] Widget was opened, checking server for activity",
        {
          sessionId,
          widgetOpened,
        }
      );

      // Check server-side for any activity on this payment intent
      try {
        const res = await fetch(
          `/api/payment/status?sessionId=${encodeURIComponent(sessionId)}`,
          { signal: abortController.signal }
        );

        if (res.ok) {
          const data: PaymentStatusResponse = await res.json();

          // If no activity and still pending, this is likely a stale session
          // where the user opened the widget but never completed payment
          if (!data.hasActivity && data.status === "pending") {
            clientLog.info(
              "[Payment] No server activity and status is pending. Clearing stale session.",
              { sessionId, status: data.status }
            );
            clearPaymentSession();
            return;
          }

          clientLog.info("[Payment] Server has activity, resuming polling", {
            sessionId,
            hasActivity: data.hasActivity,
            status: data.status,
          });
        } else if (res.status === 404) {
          // If intent not found (404), clear and allow fresh start
          clientLog.info(
            "[Payment] Payment intent not found on server, clearing"
          );
          clearPaymentSession();
          return;
        }
        // For other non-ok responses, proceed with polling (may recover)
      } catch (error) {
        // Ignore abort errors
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        // For network errors, proceed with polling
        clientLog.info(
          "[Payment] Network error checking status, proceeding with polling",
          {
            error,
          }
        );
      }

      // Resume polling with stored plan
      const planToUse = plan ?? (isTester ? "tester_paid" : "basic_annual");
      dispatch({ type: "START_PAYMENT", plan: planToUse });
      dispatch({ type: "SET_STATUS", status: "verifying" });
      await pollPaymentStatusRef.current(sessionId, 60, abortController.signal);
    };

    if (sessionStatus !== "loading" && session?.user) {
      checkExistingSession();
    }

    // Cleanup: abort ongoing polling on unmount
    return () => {
      abortController.abort();
    };
  }, [sessionStatus, session, isTester]);

  const subscribe = useCallback(
    async (plan: PlanType) => {
      if (!session?.user?.id || !session?.user?.email) {
        toast({ type: "error", description: t("error") });
        return;
      }

      if (typeof window === "undefined" || !window.cp) {
        toast({ type: "error", description: t("error") });
        return;
      }

      const publicId = process.env.NEXT_PUBLIC_CLOUDPAYMENTS_PUBLIC_ID;
      if (!publicId) {
        toast({ type: "error", description: t("error") });
        return;
      }

      try {
        dispatch({ type: "START_PAYMENT", plan });

        // Create payment intent first
        const intentRes = await fetch("/api/payment/create-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planName: plan }),
        });

        if (!intentRes.ok) {
          throw new Error("Failed to create payment intent");
        }

        const intentData: PaymentIntentResponse = await intentRes.json();

        // Store in localStorage for redirect recovery
        storePaymentSession(intentData.sessionId, intentData.expiresAt, plan);

        const displayName = getPlanDisplayName(plan, locale);
        const currency = getCurrency();
        const amount = getAmount(plan, currency);
        const recurrentConfig = getRecurrentConfig(plan);
        const receipt = buildReceipt(displayName, amount, session.user.email);
        const returnUrl = buildReturnUrl(intentData.sessionId);
        const widgetOptions = createWidgetOptions(locale, session.user.email);

        clientLog.info("[Payment] Starting charge", {
          amount,
          currency,
          selectedPlan: plan,
          sessionId: intentData.sessionId,
        });

        const widget: CloudPaymentsWidget = new window.cp.CloudPayments(
          widgetOptions
        );

        widget.pay(
          "charge",
          {
            publicId,
            description: displayName,
            amount,
            currency,
            accountId: session.user.id,
            email: session.user.email,
            skin: "classic",
            data: {
              sessionId: intentData.sessionId,
              planName: plan,
              CloudPayments: {
                CustomerReceipt: receipt,
                recurrent: {
                  ...recurrentConfig,
                  customerReceipt: receipt,
                },
              },
            },
            jsonData: {
              returnUrl,
            },
          },
          {
            onSuccess: async () => {
              await pollPaymentStatus(intentData.sessionId);
            },
            onFail: (reason) => {
              dispatch({
                type: "PAYMENT_FAILED",
                error: typeof reason === "string" ? reason : t("error"),
              });
              clearPaymentSession();
              console.error("[CloudPayments] Payment failed:", reason);
              toast({ type: "error", description: t("error") });
            },
            onComplete: (paymentResult) => {
              // Widget closed - reset UI state but DON'T clear localStorage
              // For redirect-based payments (T-Pay, SberPay), the widget closes before
              // payment completes. localStorage is needed for recovery when user returns.
              if (!paymentResult?.success) {
                dispatch({ type: "WIDGET_CLOSED" });
              }
            },
          }
        );

        // Mark that widget.pay() was called - this is the checkpoint for session recovery.
        // If user refreshes before this point, the session will be cleared as stale.
        storeWidgetOpened();
      } catch (error) {
        dispatch({
          type: "PAYMENT_FAILED",
          error: error instanceof Error ? error.message : t("error"),
        });
        console.error("Error in subscribe:", error);
        toast({ type: "error", description: t("error") });
      }
    },
    [session, t, pollPaymentStatus, locale]
  );

  const startTrial = useCallback(
    async (plan: PlanType) => {
      if (!session?.user?.id || !session?.user?.email) {
        toast({ type: "error", description: t("error") });
        return;
      }

      if (typeof window === "undefined" || !window.cp) {
        toast({ type: "error", description: t("error") });
        return;
      }

      const publicId = process.env.NEXT_PUBLIC_CLOUDPAYMENTS_PUBLIC_ID;
      if (!publicId) {
        toast({ type: "error", description: t("error") });
        return;
      }

      try {
        dispatch({ type: "START_PAYMENT", plan });

        const intentRes = await fetch("/api/payment/create-trial-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planName: plan }),
        });

        if (!intentRes.ok) {
          const errorData = await intentRes.json();
          if (errorData.code === "TRIAL_ALREADY_USED") {
            toast({ type: "error", description: t("trial.alreadyUsed") });
            dispatch({ type: "RESET" });
            return;
          }
          throw new Error("Failed to create trial intent");
        }

        const intentData: PaymentIntentResponse = await intentRes.json();

        storePaymentSession(intentData.sessionId, intentData.expiresAt, plan);

        const returnUrl = buildReturnUrl(intentData.sessionId);
        const widgetOptions = createWidgetOptions(locale, session.user.email);

        const widget: CloudPaymentsWidget = new window.cp.CloudPayments(
          widgetOptions
        );

        widget.pay(
          "auth",
          {
            publicId,
            description: t("trial.cardVerification"),
            amount: 1,
            currency: "RUB",
            accountId: session.user.id,
            email: session.user.email,
            skin: "classic",
            data: {
              sessionId: intentData.sessionId,
              planName: plan,
              isTrial: true,
            },
            jsonData: {
              returnUrl,
            },
          },
          {
            onSuccess: async () => {
              await pollPaymentStatus(intentData.sessionId);
            },
            onFail: (reason) => {
              dispatch({
                type: "PAYMENT_FAILED",
                error: typeof reason === "string" ? reason : t("error"),
              });
              clearPaymentSession();
              console.error("[CloudPayments] Trial payment failed:", reason);
              toast({ type: "error", description: t("error") });
            },
            onComplete: (paymentResult) => {
              if (!paymentResult?.success) {
                dispatch({ type: "WIDGET_CLOSED" });
              }
            },
          }
        );

        // Mark that widget.pay() was called - this is the checkpoint for session recovery.
        // If user refreshes before this point, the session will be cleared as stale.
        storeWidgetOpened();
      } catch (error) {
        dispatch({
          type: "PAYMENT_FAILED",
          error: error instanceof Error ? error.message : t("error"),
        });
        console.error("Error in startTrial:", error);
        toast({ type: "error", description: t("error") });
      }
    },
    [session, t, pollPaymentStatus, locale]
  );

  const reset = useCallback(() => {
    dispatch({ type: "RESET" });
    clearPaymentSession();
  }, []);

  return {
    state,
    subscribe,
    startTrial,
    reset,
  };
}

// Re-export types for convenience
export type { PlanType } from "./payment-reducer";
