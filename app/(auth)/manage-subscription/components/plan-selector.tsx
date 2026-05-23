"use client";

import type { PlanType } from "../hooks/payment-reducer";
import { formatPrice } from "../utils/payment-utils";
import { PlanCard } from "./plan-card";

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
  return (
    <div className="mx-auto w-full max-w-sm">
      <PlanCard
        canStartTrial={canStartTrial}
        descriptionKey="monthly.description"
        formattedPrice={formatPrice("basic_monthly")}
        isDisabled={isLoading && loadingPlan !== "basic_monthly"}
        isLoading={loadingPlan === "basic_monthly"}
        nameKey="monthly.name"
        onSubscribe={onSubscribe}
        periodKey="monthly.period"
        plan="basic_monthly"
        subscribeButtonKey="monthly.subscribeButton"
      />
    </div>
  );
}
