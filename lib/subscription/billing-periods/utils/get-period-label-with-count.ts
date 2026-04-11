import type { BillingPeriod } from "../../subscription-tiers";
import { getPeriodLabel } from "./get-period-label";

/**
 * Get period label with count for display (e.g., "per quarter" for monthly × 3)
 */
export function getPeriodLabelWithCount(
  billingPeriod: BillingPeriod,
  count = 1
): string {
  if (count === 1) {
    return getPeriodLabel(billingPeriod);
  }

  if (billingPeriod === "monthly" && count === 3) {
    return "per quarter";
  }

  if (billingPeriod === "monthly" && count === 6) {
    return "per half-year";
  }

  return `per ${count} ${billingPeriod.replace("ly", "")}s`;
}
