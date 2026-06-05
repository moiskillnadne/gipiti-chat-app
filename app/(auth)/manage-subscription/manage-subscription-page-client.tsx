"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Suspense } from "react";
import { Loader } from "@/components/elements/loader";
import { PaymentLoadingOverlay } from "@/components/payment-loading-overlay";
import { useTranslations } from "@/lib/i18n/translate";
import { FAQ } from "./components/faq";
import { PlanCardFull, type PlanFeature } from "./components/plan-card-full";
import { TrustRow } from "./components/trust-row";
import type { PlanType } from "./hooks/payment-reducer";
import { usePayment } from "./hooks/use-payment";
import { formatPrice, getPriceParts } from "./utils/payment-utils";

function SupportLink({ text, linkText }: { text: string; linkText: string }) {
  return (
    <p className="fixed right-4 bottom-4 z-50 text-ink-3 text-xs">
      {text}{" "}
      <Link className="hover:underline" href="/legal/support">
        {linkText}
      </Link>
    </p>
  );
}

export function ManageSubscriptionPageClient() {
  return (
    <Suspense fallback={<ManageSubscriptionFallback />}>
      <ManageSubscriptionContent />
    </Suspense>
  );
}

function ManageSubscriptionFallback() {
  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-paper">
      <Loader />
    </div>
  );
}

function ManageSubscriptionContent() {
  const t = useTranslations("auth.subscription");
  const tPlans = useTranslations("auth.subscription.plansPage");
  const tLegal = useTranslations("legal");
  const tSupport = useTranslations("legal.support");

  const { data: session, status: sessionStatus } = useSession();
  const isSessionLoading = sessionStatus === "loading";
  const isTester = session?.user?.isTester ?? false;

  const { state, subscribe, reset } = usePayment({
    isTester,
    successRedirectUrl: "/subscription",
  });

  const plan: PlanType = isTester ? "tester_paid" : "basic_monthly";
  const { amount, currency } = getPriceParts(plan);
  const period = isTester ? tPlans("perDay") : tPlans("perMonth");
  const balancePeriod = isTester ? tPlans("eachDay") : tPlans("eachMonth");
  const name = isTester ? t("tester.name") : t("monthly.name");
  const description = isTester
    ? t("tester.description")
    : tPlans("cardDescription");

  const features: PlanFeature[] = [
    {
      label: tPlans("features.balanceLabel", {
        amount: formatPrice(plan),
        period: balancePeriod,
      }),
      sub: tPlans("features.balanceSub"),
    },
    { label: tPlans("features.paygLabel"), sub: tPlans("features.paygSub") },
    {
      label: tPlans("features.searchLabel"),
      sub: tPlans("features.searchSub"),
    },
    { label: tPlans("features.mediaLabel"), sub: tPlans("features.mediaSub") },
    {
      label: tPlans("features.documentsLabel"),
      sub: tPlans("features.documentsSub"),
    },
    { label: tPlans("features.topupLabel"), sub: tPlans("features.topupSub") },
  ];

  return (
    <div className="min-h-dvh w-full bg-paper">
      <div className="mx-auto w-full max-w-[1080px] px-6 pb-16">
        {/* Hero */}
        <header className="px-2 pt-16 pb-12 text-center">
          <h1 className="font-medium text-[40px] text-ink leading-[1.02] tracking-[-0.035em] sm:text-[54px]">
            {tPlans("heroTitleLine1")}
            <br />
            <em className="text-citrus-deep not-italic">
              {tPlans("heroTitleLine2")}
            </em>
          </h1>
          <p className="mx-auto mt-[22px] max-w-[52ch] text-[17px] text-ink-2 leading-[1.55]">
            {tPlans("heroSubtitle")}
          </p>
        </header>

        {/* Plan card */}
        {isSessionLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader />
          </div>
        ) : (
          <PlanCardFull
            ctaLabel={tPlans("buy")}
            currency={currency}
            description={description}
            features={features}
            isLoading={state.isLoading}
            loadingLabel={t("subscribing")}
            name={name}
            onSubscribe={() => subscribe(plan)}
            period={period}
            priceAmount={amount}
            whatsIncludedLabel={tPlans("whatsIncluded")}
          />
        )}

        {/* Trust */}
        <div className="mt-12">
          <TrustRow />
        </div>

        {/* FAQ */}
        <div className="mt-20">
          <FAQ />
        </div>

        {/* Footer */}
        <footer className="mt-12 border-rule border-t pt-9">
          <div className="flex flex-wrap justify-center gap-x-7 gap-y-2">
            <Link
              className="text-[13px] text-ink-3 hover:text-ink"
              href="/legal/offer"
              target="_blank"
            >
              {tLegal("offer.linkText")}
            </Link>
            <Link
              className="text-[13px] text-ink-3 hover:text-ink"
              href="/legal/privacy"
              target="_blank"
            >
              {tLegal("privacy.linkText")}
            </Link>
            <Link
              className="text-[13px] text-ink-3 hover:text-ink"
              href="/legal/requisites"
              target="_blank"
            >
              {tLegal("requisites.linkText")}
            </Link>
          </div>
        </footer>
      </div>

      <SupportLink
        linkText={tSupport("linkText")}
        text={tSupport("needHelp")}
      />

      <PaymentLoadingOverlay
        error={state.error}
        isOpen={state.isLoading}
        onRetry={reset}
        status={state.status}
      />
    </div>
  );
}
