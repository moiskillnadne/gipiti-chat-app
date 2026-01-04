"use client";

import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/config";
import type { PlanType } from "../hooks/payment-reducer";
import { formatPrice } from "../utils/payment-utils";
import { PlanCard } from "./PlanCard";

type PlanSelectorProps = {
  onSubscribe: (plan: PlanType) => void;
  canStartTrial?: boolean;
  isLoading: boolean;
  loadingPlan: PlanType | null;
};

export function PlanSelector({
  onSubscribe,
  canStartTrial = false,
  isLoading,
  loadingPlan,
}: PlanSelectorProps) {
  const t = useTranslations("auth.subscription");
  const locale = useLocale() as Locale;

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <PlanCard
        canStartTrial={canStartTrial}
        descriptionKey="monthly.description"
        formattedPrice={formatPrice("basic_monthly", locale)}
        isDisabled={isLoading && loadingPlan !== "basic_monthly"}
        isLoading={loadingPlan === "basic_monthly"}
        nameKey="monthly.name"
        onSubscribe={onSubscribe}
        periodKey="monthly.period"
        plan="basic_monthly"
        subscribeButtonKey="monthly.subscribeButton"
      />

      <PlanCard
        badge={t("quarterly.badge")}
        canStartTrial={canStartTrial}
        descriptionKey="quarterly.description"
        formattedPrice={formatPrice("basic_quarterly", locale)}
        isDisabled={isLoading && loadingPlan !== "basic_quarterly"}
        isLoading={loadingPlan === "basic_quarterly"}
        isRecommended
        nameKey="quarterly.name"
        onSubscribe={onSubscribe}
        periodKey="quarterly.period"
        plan="basic_quarterly"
        subscribeButtonKey="quarterly.subscribeButton"
      />

      <PlanCard
        badge={t("annual.badge")}
        canStartTrial={canStartTrial}
        descriptionKey="annual.description"
        formattedPrice={formatPrice("basic_annual", locale)}
        isDisabled={isLoading && loadingPlan !== "basic_annual"}
        isLoading={loadingPlan === "basic_annual"}
        nameKey="annual.name"
        onSubscribe={onSubscribe}
        periodKey="annual.period"
        plan="basic_annual"
        subscribeButtonKey="annual.subscribeButton"
      />
    </div>
  );
}
