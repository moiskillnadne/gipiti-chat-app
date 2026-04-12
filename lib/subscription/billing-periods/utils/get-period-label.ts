import type { BillingPeriod } from "../../subscription-tiers";

/**
 * Get period label for display
 */
export function getPeriodLabel(billingPeriod: BillingPeriod): string {
  switch (billingPeriod) {
    case "daily":
      return "per day";
    case "weekly":
      return "per week";
    case "monthly":
      return "per month";
    case "annual":
      return "per year";
    default:
      return "per period";
  }
}
