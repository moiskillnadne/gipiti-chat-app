"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { Suspense, useCallback, useState } from "react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { toast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { SUBSCRIPTION_TIERS } from "@/lib/ai/subscription-tiers";
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

type PlanType = "basic_monthly" | "basic_annual" | "tester_paid";

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

  const handleSessionUpdate = useCallback(async () => {
    await updateSession({ hasActiveSubscription: true });
    router.replace("/");
  }, [updateSession, router]);

  const handleSubscribe = useCallback(() => {
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

    setIsLoading(true);

    const tier = SUBSCRIPTION_TIERS[selectedPlan];
    const displayName = tier.displayName[locale];
    const currency = getCurrency();
    const amount = getAmount(selectedPlan, currency);

    console.log("amount", amount);
    console.log("currency", currency);
    console.log("selectedPlan", selectedPlan);
    console.log("tier", tier);
    console.log("session.user.email", session.user.email);
    console.log("publicId", publicId);
    console.log("description", `${displayName}`);

    let recurrentConfig: { interval: "Day" | "Month"; period: number };
    if (selectedPlan === "tester_paid") {
      recurrentConfig = { interval: "Day", period: 1 };
    } else if (selectedPlan === "basic_annual") {
      recurrentConfig = { interval: "Month", period: 12 };
    } else {
      recurrentConfig = { interval: "Month", period: 1 };
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
      mirPaySupport: false,
      speiSupport: false,
      cashSupport: false,
      cardInstallmentSupport: false,
      foreignSupport: false,
      sbpSupport: false,
      sberPaySupport: false,
      tinkoffPaySupport: false,
    });

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
          planName: selectedPlan,
          CloudPayments: {
            CustomerReceipt: receipt,
            recurrent: {
              ...recurrentConfig,
              customerReceipt: receipt,
            },
          },
        },
      },
      {
        onSuccess: async () => {
          for (let i = 0; i < 10; i++) {
            try {
              const res = await fetch("/api/subscription");
              const data = await res.json();
              if (data.subscription?.status === "active") {
                setIsLoading(false);
                toast({ type: "success", description: t("success") });
                handleSessionUpdate();
                return;
              }
            } catch {
              // Continue polling
            }
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
          setIsLoading(false);
          toast({ type: "success", description: t("success") });
          handleSessionUpdate();
        },
        onFail: (reason) => {
          setIsLoading(false);
          console.error("[CloudPayments] Payment failed:", reason);
          toast({ type: "error", description: t("error") });
        },
        onComplete: () => {
          setIsLoading(false);
        },
      }
    );
  }, [
    session,
    selectedPlan,
    t,
    handleSessionUpdate,
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
          <div className="grid gap-6 md:grid-cols-2">
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
                {t("features.tokens")}
              </span>
            </li>
            <li className="flex items-center gap-3">
              <CheckIcon className="text-emerald-500" />
              <span className="text-gray-600 text-sm dark:text-zinc-400">
                {t("features.messages")}
              </span>
            </li>
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
            className="font-medium text-gray-600 text-sm hover:underline dark:text-zinc-400"
            onClick={() => signOut({ callbackUrl: "/login" })}
            type="button"
          >
            {tNav("signOut")}
          </button>

          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
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
    </div>
  );
}
