"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { PaymentLoadingOverlay } from "@/components/payment-loading-overlay";
import { toast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { SUBSCRIPTION_TIERS } from "@/lib/subscription/subscription-tiers";
import type {
  PaymentIntentResponse,
  PaymentStatus,
  PaymentStatusResponse,
} from "@/lib/types";
import { Loader } from "../../../components/elements/loader";
import type { Locale } from "../../../i18n/config";
import type {
  CloudPaymentsReceipt,
  CloudPaymentsWidget,
} from "../../../lib/payments/cloudpayments-types";

function buildReceipt(
  label: string,
  amount: number,
  email: string
): CloudPaymentsReceipt {
  return {
    Items: [
      {
        label,
        price: amount,
        quantity: 1.0,
        amount,
        vat: 20,
        method: 4,
        object: 4,
      },
    ],
    taxationSystem: 0,
    email,
    isBso: false,
    amounts: {
      electronic: amount,
      advancePayment: 0,
      credit: 0,
      provision: 0,
    },
  };
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      height="16"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="16"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<SubscribePageFallback />}>
      <SubscribePage />
    </Suspense>
  );
}

function SubscribePageFallback() {
  const t = useTranslations("auth.subscription");

  return (
    <div className="flex min-h-dvh w-screen items-start justify-center bg-background pt-12 md:items-center md:pt-0">
      <div className="flex w-full max-w-3xl flex-col gap-8 px-4">
        <div className="flex flex-col items-center justify-center gap-2 text-center">
          <h1 className="font-bold text-3xl dark:text-zinc-50">{t("title")}</h1>
          <p className="text-gray-500 text-lg dark:text-zinc-400">
            {t("subtitle")}
          </p>
        </div>
      </div>
    </div>
  );
}

type PlanType =
  | "basic_monthly"
  | "basic_quarterly"
  | "basic_annual"
  | "tester_paid";

function SubscribePage() {
  const t = useTranslations("auth.subscription");
  const tNav = useTranslations("common.navigation");
  const tLegal = useTranslations("legal");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const {
    data: session,
    update: updateSession,
    status: sessionStatus,
  } = useSession();

  const isSessionLoading = sessionStatus === "loading";

  const isTester = session?.user?.isTester ?? false;

  const formatPrice = (plan: PlanType) => {
    const tier = SUBSCRIPTION_TIERS[plan];
    if (locale === "ru") {
      return `${tier.price.RUB.toLocaleString("ru-RU")} ₽`;
    }
    return `$${tier.price.USD}`;
  };

  const getAmount = useCallback((plan: PlanType, currency: "RUB" | "USD") => {
    const tier = SUBSCRIPTION_TIERS[plan];

    if (tier.price[currency]) {
      return tier.price[currency];
    }

    throw new Error(`Price for ${plan} in ${currency} is not defined`);
  }, []);

  const getCurrency = useCallback(() => {
    return "RUB";
  }, []);

  const [selectedPlan, setSelectedPlan] = useState<PlanType>(
    isTester ? "tester_paid" : "basic_annual"
  );
  const [isLoading, setIsLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(
    null
  );
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Polling guard to prevent concurrent polling loops
  const isPollingRef = useRef(false);

  const handleSessionUpdate = useCallback(async () => {
    await updateSession({ hasActiveSubscription: true });
    router.replace("/");
  }, [updateSession, router]);

  // Poll payment status using the new payment intent system
  const pollPaymentStatus = useCallback(
    async (sessionId: string, maxRetries = 10, abortSignal?: AbortSignal) => {
      // Guard against concurrent polling
      if (isPollingRef.current) {
        console.warn("[Payment] Polling already in progress, skipping");
        return;
      }

      isPollingRef.current = true;

      try {
        setPaymentStatus("verifying");

        for (let i = 0; i < maxRetries; i++) {
          // Check if polling was aborted
          if (abortSignal?.aborted) {
            console.log("[Payment] Polling aborted");
            return;
          }

          // Check if session expired before polling
          const expiresAt = localStorage.getItem("payment_expires_at");
          if (expiresAt && new Date(expiresAt) < new Date()) {
            setPaymentStatus("expired");
            setPaymentError("Payment session expired");
            setIsLoading(false);
            localStorage.removeItem("payment_session_id");
            localStorage.removeItem("payment_expires_at");
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

            // Always update status (don't compare with closure variable)
            setPaymentStatus(data.status);

            if (data.status === "succeeded") {
              setPaymentStatus("activating");
              await new Promise((resolve) => setTimeout(resolve, 500));

              setPaymentStatus("succeeded");
              toast({ type: "success", description: t("success") });

              localStorage.removeItem("payment_session_id");
              localStorage.removeItem("payment_expires_at");

              await new Promise((resolve) => setTimeout(resolve, 500));
              await handleSessionUpdate();
              return;
            }

            if (data.status === "failed" || data.status === "expired") {
              setPaymentError(data.failureReason || null);
              setIsLoading(false);
              toast({ type: "error", description: t("error") });
              localStorage.removeItem("payment_session_id");
              localStorage.removeItem("payment_expires_at");
              return;
            }
          } catch (error) {
            // Ignore abort errors
            if (error instanceof Error && error.name === "AbortError") {
              console.log("[Payment] Fetch aborted");
              return;
            }
            console.error("Polling error:", error);
          }

          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        // Timeout: redirect to extended polling page
        router.push(
          `/payment-status?sessionId=${encodeURIComponent(sessionId)}`
        );
      } finally {
        isPollingRef.current = false;
      }
    },
    [t, handleSessionUpdate, router]
  );

  // Store latest pollPaymentStatus ref to avoid useEffect re-triggers
  const pollPaymentStatusRef = useRef(pollPaymentStatus);
  pollPaymentStatusRef.current = pollPaymentStatus;

  // Check for existing payment session on mount (redirect recovery)
  useEffect(() => {
    const abortController = new AbortController();

    const checkExistingSession = async () => {
      // Check URL params first (CloudPayments callback may add it)
      const urlParams = new URLSearchParams(window.location.search);
      let sessionId = urlParams.get("sessionId");

      // Fallback to sessionStorage
      if (!sessionId) {
        sessionId = localStorage.getItem("payment_session_id");
      }

      if (!sessionId) {
        return;
      }

      // Check expiration
      const expiresAt = localStorage.getItem("payment_expires_at");
      if (expiresAt && new Date(expiresAt) < new Date()) {
        localStorage.removeItem("payment_session_id");
        localStorage.removeItem("payment_expires_at");
        return;
      }

      // Resume polling
      setIsLoading(true);
      setPaymentStatus("verifying");
      await pollPaymentStatusRef.current(sessionId, 10, abortController.signal);
    };

    if (sessionStatus !== "loading" && session?.user) {
      checkExistingSession();
    }

    // Cleanup: abort ongoing polling on unmount
    return () => {
      abortController.abort();
    };
  }, [sessionStatus, session]);

  const handleSubscribe = useCallback(async () => {
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
      setIsLoading(true);
      setPaymentStatus("processing");
      setPaymentError(null);

      // Create payment intent first
      const intentRes = await fetch("/api/payment/create-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planName: selectedPlan }),
      });

      if (!intentRes.ok) {
        throw new Error("Failed to create payment intent");
      }

      const intentData: PaymentIntentResponse = await intentRes.json();

      // Store in sessionStorage for redirect recovery
      localStorage.setItem("payment_session_id", intentData.sessionId);
      localStorage.setItem("payment_expires_at", intentData.expiresAt);

      const tier = SUBSCRIPTION_TIERS[selectedPlan];
      const displayName = tier.displayName[locale];
      const currency = getCurrency();
      const amount = getAmount(selectedPlan, currency);

      console.log("amount", amount);
      console.log("currency", currency);
      console.log("selectedPlan", selectedPlan);
      console.log("sessionId", intentData.sessionId);

      let recurrentConfig: { interval: "Day" | "Month"; period: number };
      if (tier.billingPeriod === "daily") {
        recurrentConfig = { interval: "Day", period: tier.billingPeriodCount };
      } else if (tier.billingPeriod === "annual") {
        recurrentConfig = {
          interval: "Month",
          period: 12 * tier.billingPeriodCount,
        };
      } else {
        recurrentConfig = {
          interval: "Month",
          period: tier.billingPeriodCount,
        };
      }

      const receipt = buildReceipt(displayName, amount, session.user.email);

      const widget: CloudPaymentsWidget = new window.cp.CloudPayments({
        language: locale,
        email: session.user.email,
        applePaySupport: false,
        googlePaySupport: false,
        yandexPaySupport: false,
        masterPassSupport: false,
        tinkoffInstallmentSupport: false,
        loanSupport: false,
        dolyameSupport: false,
        mirPaySupport: true,
        speiSupport: false,
        cashSupport: false,
        cardInstallmentSupport: false,
        foreignSupport: false,
        sbpSupport: false,
        sberPaySupport: true,
        tinkoffPaySupport: true,
      });

      const returnUrl = `${window.location.origin}/payment-status?sessionId=${encodeURIComponent(intentData.sessionId)}`;

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
            sessionId: intentData.sessionId, // CRITICAL: webhook will use this
            planName: selectedPlan,
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
            // Start polling using the new payment status endpoint
            await pollPaymentStatus(intentData.sessionId);
          },
          onFail: (reason) => {
            setIsLoading(false);
            setPaymentStatus("failed");
            setPaymentError(typeof reason === "string" ? reason : t("error"));
            localStorage.removeItem("payment_session_id");
            localStorage.removeItem("payment_expires_at");
            console.error("[CloudPayments] Payment failed:", reason);
            toast({ type: "error", description: t("error") });
          },
          onComplete: (paymentResult) => {
            // Widget closed - reset UI state but DON'T clear sessionStorage
            // For redirect-based payments (T-Pay, SberPay), the widget closes before
            // payment completes. SessionStorage is needed for recovery when user returns.
            // It will expire naturally based on payment_expires_at (30 min).
            if (!paymentResult || !paymentResult.success) {
              setIsLoading(false);
              setPaymentStatus(null);
            }
          },
        }
      );
    } catch (error) {
      setIsLoading(false);
      setPaymentStatus("failed");
      setPaymentError(error instanceof Error ? error.message : t("error"));
      console.error("Error in handleSubscribe:", error);
      toast({ type: "error", description: t("error") });
    }
  }, [
    session,
    selectedPlan,
    t,
    pollPaymentStatus,
    getAmount,
    getCurrency,
    locale,
  ]);

  return (
    <div className="flex min-h-dvh w-screen items-start justify-center bg-background pt-12 md:items-center md:pt-0">
      <div className="flex w-full max-w-3xl flex-col gap-10 px-4 py-8">
        <div className="flex flex-col items-center justify-center gap-2 text-center">
          <h1 className="font-bold text-3xl dark:text-zinc-50">{t("title")}</h1>
          <p className="text-gray-500 text-lg dark:text-zinc-400">
            {t("subtitle")}
          </p>
        </div>

        {isSessionLoading && (
          <div className="flex items-center justify-center">
            <Loader />
          </div>
        )}

        {isTester && !isSessionLoading && (
          <div className="mx-auto max-w-md">
            <div className="relative flex flex-col rounded-2xl border-2 border-blue-500 bg-blue-50/50 p-6 text-left dark:border-blue-400 dark:bg-blue-950/30">
              <span className="-top-3 absolute right-4 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-3 py-1 font-medium text-white text-xs">
                Tester
              </span>

              <div className="mb-4">
                <h3 className="font-semibold text-xl dark:text-zinc-50">
                  {t("tester.name")}
                </h3>
              </div>

              <div className="mb-4">
                <span className="font-bold text-4xl dark:text-zinc-50">
                  {formatPrice("tester_paid")}
                </span>
                <span className="text-gray-500 dark:text-zinc-400">
                  {t("tester.period")}
                </span>
              </div>

              <p className="text-gray-600 text-sm dark:text-zinc-400">
                {t("tester.description")}
              </p>
            </div>
          </div>
        )}

        {!isTester && !isSessionLoading && (
          <div className="grid gap-6 md:grid-cols-3">
            <button
              className={`relative flex cursor-pointer flex-col rounded-2xl border-2 p-6 text-left transition-all ${
                selectedPlan === "basic_monthly"
                  ? "border-blue-500 bg-blue-50/50 dark:border-blue-400 dark:bg-blue-950/30"
                  : "border-gray-200 hover:border-gray-300 dark:border-zinc-700 dark:hover:border-zinc-600"
              }`}
              onClick={() => setSelectedPlan("basic_monthly")}
              type="button"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold text-xl dark:text-zinc-50">
                  {t("monthly.name")}
                </h3>
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                    selectedPlan === "basic_monthly"
                      ? "border-blue-500 bg-blue-500"
                      : "border-gray-300 dark:border-zinc-600"
                  }`}
                >
                  {selectedPlan === "basic_monthly" && (
                    <CheckIcon className="text-white" />
                  )}
                </div>
              </div>

              <div className="mb-4">
                <span className="font-bold text-4xl dark:text-zinc-50">
                  {formatPrice("basic_monthly")}
                </span>
                <span className="text-gray-500 dark:text-zinc-400">
                  {t("monthly.period")}
                </span>
              </div>

              <p className="text-gray-600 text-sm dark:text-zinc-400">
                {t("monthly.description")}
              </p>
            </button>

            <button
              className={`relative flex cursor-pointer flex-col rounded-2xl border-2 p-6 text-left transition-all ${
                selectedPlan === "basic_quarterly"
                  ? "border-blue-500 bg-blue-50/50 dark:border-blue-400 dark:bg-blue-950/30"
                  : "border-gray-200 hover:border-gray-300 dark:border-zinc-700 dark:hover:border-zinc-600"
              }`}
              onClick={() => setSelectedPlan("basic_quarterly")}
              type="button"
            >
              <span className="-top-3 absolute right-4 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-3 py-1 font-medium text-white text-xs">
                {t("quarterly.badge")}
              </span>

              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold text-xl dark:text-zinc-50">
                  {t("quarterly.name")}
                </h3>
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                    selectedPlan === "basic_quarterly"
                      ? "border-blue-500 bg-blue-500"
                      : "border-gray-300 dark:border-zinc-600"
                  }`}
                >
                  {selectedPlan === "basic_quarterly" && (
                    <CheckIcon className="text-white" />
                  )}
                </div>
              </div>

              <div className="mb-4">
                <span className="font-bold text-4xl dark:text-zinc-50">
                  {formatPrice("basic_quarterly")}
                </span>
                <span className="text-gray-500 dark:text-zinc-400">
                  {t("quarterly.period")}
                </span>
              </div>

              <p className="text-gray-600 text-sm dark:text-zinc-400">
                {t("quarterly.description")}
              </p>
            </button>

            <button
              className={`relative flex cursor-pointer flex-col rounded-2xl border-2 p-6 text-left transition-all ${
                selectedPlan === "basic_annual"
                  ? "border-blue-500 bg-blue-50/50 dark:border-blue-400 dark:bg-blue-950/30"
                  : "border-gray-200 hover:border-gray-300 dark:border-zinc-700 dark:hover:border-zinc-600"
              }`}
              onClick={() => setSelectedPlan("basic_annual")}
              type="button"
            >
              <span className="-top-3 absolute right-4 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-3 py-1 font-medium text-white text-xs">
                {t("annual.badge")}
              </span>

              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold text-xl dark:text-zinc-50">
                  {t("annual.name")}
                </h3>
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                    selectedPlan === "basic_annual"
                      ? "border-blue-500 bg-blue-500"
                      : "border-gray-300 dark:border-zinc-600"
                  }`}
                >
                  {selectedPlan === "basic_annual" && (
                    <CheckIcon className="text-white" />
                  )}
                </div>
              </div>

              <div className="mb-4">
                <span className="font-bold text-4xl dark:text-zinc-50">
                  {formatPrice("basic_annual")}
                </span>
                <span className="text-gray-500 dark:text-zinc-400">
                  {t("annual.period")}
                </span>
              </div>

              <p className="text-gray-600 text-sm dark:text-zinc-400">
                {t("annual.description")}
              </p>
            </button>
          </div>
        )}

        {/* Features List */}
        <div className="mx-auto max-w-md">
          <h4 className="mb-4 text-center font-medium text-gray-900 dark:text-zinc-100">
            {t("features.title")}
          </h4>
          <ul className="space-y-3">
            <li className="flex items-center gap-3">
              <CheckIcon className="text-emerald-500" />
              <span className="text-gray-600 text-sm dark:text-zinc-400">
                {t("features.models")}
              </span>
            </li>
            <li className="flex items-center gap-3">
              <CheckIcon className="text-emerald-500" />
              <span className="text-gray-600 text-sm dark:text-zinc-400">
                {t("features.search")}
              </span>
            </li>
            <li className="flex items-center gap-3">
              <CheckIcon className="text-emerald-500" />
              <span className="text-gray-600 text-sm dark:text-zinc-400">
                {t("features.fileSize")}
              </span>
            </li>
          </ul>
        </div>

        {/* Subscribe Button */}
        <div className="flex flex-col items-center gap-4">
          <Button
            className="w-full max-w-md bg-blue-600 py-6 text-lg hover:bg-blue-700"
            disabled={isLoading}
            onClick={handleSubscribe}
            size="lg"
          >
            {isLoading ? t("subscribing") : t("subscribeButton")}
          </Button>

          <button
            className="my-2 font-medium text-gray-600 text-sm hover:underline dark:text-zinc-400"
            onClick={() => signOut({ callbackUrl: "/login" })}
            type="button"
          >
            {tNav("signOut")}
          </button>

          <div className="mb-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <Link
              className="font-medium text-gray-500 text-xs hover:underline dark:text-zinc-500"
              href="/legal/offer"
              target="_blank"
            >
              {tLegal("offer.linkText")}
            </Link>
            <Link
              className="font-medium text-gray-500 text-xs hover:underline dark:text-zinc-500"
              href="/legal/privacy"
              target="_blank"
            >
              {tLegal("privacy.linkText")}
            </Link>
            <Link
              className="font-medium text-gray-500 text-xs hover:underline dark:text-zinc-500"
              href="/legal/requisites"
              target="_blank"
            >
              {tLegal("requisites.linkText")}
            </Link>
          </div>
        </div>
      </div>

      <div className="fixed bottom-4 left-4 z-50">
        <LanguageSwitcher />
      </div>

      <PaymentLoadingOverlay
        error={paymentError}
        isOpen={isLoading}
        onRetry={() => {
          setPaymentError(null);
          setPaymentStatus(null);
          setIsLoading(false);
          localStorage.removeItem("payment_session_id");
          localStorage.removeItem("payment_expires_at");
        }}
        status={paymentStatus}
      />
    </div>
  );
}
