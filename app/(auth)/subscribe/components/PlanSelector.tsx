"use client";

import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/config";
import type { PlanType } from "../hooks/payment-reducer";
import { formatPrice } from "../utils/payment-utils";
import { PlanCard } from "./PlanCard";

type PlanSelectorProps = {
  selectedPlan: PlanType;
  onPlanChange: (plan: PlanType) => void;
};

export function PlanSelector({ selectedPlan, onPlanChange }: PlanSelectorProps) {
  const t = useTranslations("auth.subscription");
  const locale = useLocale() as Locale;

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <PlanCard
        descriptionKey="monthly.description"
        formattedPrice={formatPrice("basic_monthly", locale)}
        isSelected={selectedPlan === "basic_monthly"}
        nameKey="monthly.name"
        onSelect={onPlanChange}
        periodKey="monthly.period"
        plan="basic_monthly"
      />

      <PlanCard
        badge={t("quarterly.badge")}
        descriptionKey="quarterly.description"
        formattedPrice={formatPrice("basic_quarterly", locale)}
        isSelected={selectedPlan === "basic_quarterly"}
        nameKey="quarterly.name"
        onSelect={onPlanChange}
        periodKey="quarterly.period"
        plan="basic_quarterly"
      />

      <PlanCard
        badge={t("annual.badge")}
        descriptionKey="annual.description"
        formattedPrice={formatPrice("basic_annual", locale)}
        isSelected={selectedPlan === "basic_annual"}
        nameKey="annual.name"
        onSelect={onPlanChange}
        periodKey="annual.period"
        plan="basic_annual"
      />
    </div>
  );
}

