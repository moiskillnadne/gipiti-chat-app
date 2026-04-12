import type { BillingPeriod } from "../../subscription-tiers";

/**
 * Get period duration in days (approximate for display)
 */
export function getPeriodDurationDays(
  billingPeriod: BillingPeriod,
  count = 1
): number {
  let baseDays: number;
  switch (billingPeriod) {
    case "daily":
      baseDays = 1;
      break;
    case "weekly":
      baseDays = 7;
      break;
    case "monthly":
      baseDays = 30;
      break;
    case "annual":
      baseDays = 365;
      break;
    default:
      baseDays = 30;
  }
  return baseDays * count;
}
