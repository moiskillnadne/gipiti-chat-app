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
} from "../utils/payment-utils";
import {
  createInitialState,
  type PaymentAction,
  type PaymentState,
  type PlanType,
  paymentReducer,
} from "./payment-reducer";

export type UsePaymentOptions = {
  isTester: boolean;
};

export type UsePaymentReturn = {
  state: PaymentState;
  selectPlan: (plan: PlanType) => void;
  subscribe: () => Promise<void>;
  startTrial: () => Promise<void>;
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
    router.replace("/");
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
      const { expiresAt } = getStoredPaymentSession();
      if (isPaymentSessionExpired(expiresAt)) {
        clearPaymentSession();
        return;
      }

      // Resume polling
      dispatch({ type: "START_PAYMENT" });
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
  }, [sessionStatus, session]);

  const subscribe = useCallback(async () => {
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
      dispatch({ type: "START_PAYMENT" });

      // Create payment intent first
      const intentRes = await fetch("/api/payment/create-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planName: state.selectedPlan }),
      });

      if (!intentRes.ok) {
        throw new Error("Failed to create payment intent");
      }

      const intentData: PaymentIntentResponse = await intentRes.json();

      // Store in localStorage for redirect recovery
      storePaymentSession(intentData.sessionId, intentData.expiresAt);

      const displayName = getPlanDisplayName(state.selectedPlan, locale);
      const currency = getCurrency();
      const amount = getAmount(state.selectedPlan, currency);
      const recurrentConfig = getRecurrentConfig(state.selectedPlan);
      const receipt = buildReceipt(displayName, amount, session.user.email);
      const returnUrl = buildReturnUrl(intentData.sessionId);
      const widgetOptions = createWidgetOptions(locale, session.user.email);

      clientLog.info("[Payment] Starting charge", {
        amount,
        currency,
        selectedPlan: state.selectedPlan,
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
            planName: state.selectedPlan,
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
    } catch (error) {
      dispatch({
        type: "PAYMENT_FAILED",
        error: error instanceof Error ? error.message : t("error"),
      });
      console.error("Error in subscribe:", error);
      toast({ type: "error", description: t("error") });
    }
  }, [session, state.selectedPlan, t, pollPaymentStatus, locale]);

  const startTrial = useCallback(async () => {
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
      dispatch({ type: "START_PAYMENT" });

      const intentRes = await fetch("/api/payment/create-trial-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planName: state.selectedPlan }),
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

      storePaymentSession(intentData.sessionId, intentData.expiresAt);

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
            planName: state.selectedPlan,
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
    } catch (error) {
      dispatch({
        type: "PAYMENT_FAILED",
        error: error instanceof Error ? error.message : t("error"),
      });
      console.error("Error in startTrial:", error);
      toast({ type: "error", description: t("error") });
    }
  }, [session, state.selectedPlan, t, pollPaymentStatus, locale]);

  const selectPlan = useCallback((plan: PlanType) => {
    dispatch({ type: "SELECT_PLAN", plan });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: "RESET" });
    clearPaymentSession();
  }, []);

  return {
    state,
    selectPlan,
    subscribe,
    startTrial,
    reset,
  };
}

// Re-export types for convenience
export type { PlanType } from "./payment-reducer";
