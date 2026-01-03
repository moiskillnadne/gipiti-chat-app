"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Suspense } from "react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { PaymentLoadingOverlay } from "@/components/payment-loading-overlay";
import { Button } from "@/components/ui/button";
import { Loader } from "../../../components/elements/loader";
import { FeaturesList } from "./components/FeaturesList";
import { PlanSelector } from "./components/PlanSelector";
import { TesterPlan } from "./components/TesterPlan";
import { TrialBanner } from "./components/TrialBanner";
import { usePayment } from "./hooks/usePayment";

function SupportLink({ text, linkText }: { text: string; linkText: string }) {
  return (
    <p className="fixed right-4 bottom-4 z-50 text-gray-500 text-xs dark:text-zinc-500">
      {text}{" "}
      <Link className="hover:underline" href="/legal/support">
        {linkText}
      </Link>
    </p>
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
  const tSupport = useTranslations("legal.support");

  const { data: session, status: sessionStatus } = useSession();
  const isSessionLoading = sessionStatus === "loading";

  const isTester = session?.user?.isTester ?? false;
  const hasUsedTrial = session?.user?.hasUsedTrial ?? true;
  // Trial is only available to testers until production rollout
  const canStartTrial = isTester && !hasUsedTrial;

  const { state, selectPlan, subscribe, startTrial, reset } = usePayment({
    isTester,
  });

  return (
    <div className="flex min-h-dvh w-screen items-start justify-center bg-background pt-12 md:items-center md:pt-0">
      <div className="flex w-full max-w-3xl flex-col gap-10 px-4 py-8">
        {/* Header */}
        <div className="flex flex-col items-center justify-center gap-2 text-center">
          <h1 className="font-bold text-3xl dark:text-zinc-50">{t("title")}</h1>
          <p className="text-gray-500 text-lg dark:text-zinc-400">
            {t("subtitle")}
          </p>
        </div>

        {/* Loading State */}
        {isSessionLoading && (
          <div className="flex items-center justify-center">
            <Loader />
          </div>
        )}

        {/* Plan Selection */}
        {isTester && !isSessionLoading && <TesterPlan />}

        {!isTester && !isSessionLoading && (
          <PlanSelector
            onPlanChange={selectPlan}
            selectedPlan={state.selectedPlan}
          />
        )}

        {/* Features List */}
        <FeaturesList />

        {/* Trial Banner */}
        {canStartTrial && !isSessionLoading && (
          <TrialBanner
            isLoading={state.isLoading}
            onStartTrial={startTrial}
            selectedPlan={state.selectedPlan}
          />
        )}

        {/* Subscribe Button */}
        <div className="flex flex-col items-center gap-4">
          <Button
            className="w-full max-w-md bg-blue-600 py-6 text-lg hover:bg-blue-700"
            disabled={state.isLoading}
            onClick={subscribe}
            size="lg"
          >
            {state.isLoading ? t("subscribing") : t("subscribeButton")}
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

      {/* Fixed UI Elements */}
      <div className="fixed bottom-4 left-4 z-50">
        <LanguageSwitcher />
      </div>
      <SupportLink
        linkText={tSupport("linkText")}
        text={tSupport("needHelp")}
      />

      {/* Payment Loading Overlay */}
      <PaymentLoadingOverlay
        error={state.error}
        isOpen={state.isLoading}
        onRetry={reset}
        status={state.status}
      />
    </div>
  );
}
