"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import {
  Suspense,
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { toast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { SUBSCRIPTION_TIERS } from "@/lib/ai/subscription-tiers";
import { type SubscribeActionState, subscribe } from "../actions";

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

function SubscribePage() {
  const t = useTranslations("auth.subscription");
  const tNav = useTranslations("common.navigation");
  const tLegal = useTranslations("legal");
  const locale = useLocale();
  const router = useRouter();
  const { update: updateSession } = useSession();

  const formatPrice = (plan: "basic_monthly" | "basic_annual") => {
    const tier = SUBSCRIPTION_TIERS[plan];
    if (locale === "ru") {
      return `${tier.price.RUB.toLocaleString("ru-RU")} ₽`;
    }
    return `$${tier.price.USD}`;
  };

  const [selectedPlan, setSelectedPlan] = useState<
    "basic_monthly" | "basic_annual"
  >("basic_annual");
  const hasHandledSuccess = useRef(false);

  const [state, _formAction] = useActionState<SubscribeActionState, FormData>(
    subscribe,
    { status: "idle" }
  );

  const handleSessionUpdate = useCallback(async () => {
    await updateSession({ hasActiveSubscription: true });
    router.replace("/");
  }, [updateSession, router]);

  useEffect(() => {
    if (state.status === "failed") {
      toast({ type: "error", description: t("error") });
      return;
    }

    if (state.status === "invalid_data") {
      toast({ type: "error", description: t("error") });
      return;
    }

    if (state.status === "success" && !hasHandledSuccess.current) {
      hasHandledSuccess.current = true;
      toast({ type: "success", description: t("success") });
      handleSessionUpdate();
    }
  }, [state.status, t, handleSessionUpdate]);

  const handleSubscribe = useCallback(() => {
    toast({ type: "info", description: t("comingSoon") });
  }, [t]);

  const isLoading = state.status === "in_progress";

  return (
    <div className="flex min-h-dvh w-screen items-start justify-center bg-background pt-12 md:items-center md:pt-0">
      <div className="flex w-full max-w-3xl flex-col gap-10 px-4 py-8">
        <div className="flex flex-col items-center justify-center gap-2 text-center">
          <h1 className="font-bold text-3xl dark:text-zinc-50">{t("title")}</h1>
          <p className="text-gray-500 text-lg dark:text-zinc-400">
            {t("subtitle")}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Monthly Plan Card */}
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

          {/* Annual Plan Card */}
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
