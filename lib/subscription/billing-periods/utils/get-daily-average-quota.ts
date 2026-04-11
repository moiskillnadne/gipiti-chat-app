import type { BillingPeriod } from "../../subscription-tiers";
import { getPeriodDurationDays } from "./get-period-duration-days";

/**
 * Calculate daily average quota
 */
export function getDailyAverageQuota(
  totalQuota: number,
  billingPeriod: BillingPeriod,
  count = 1
): number {
  const days = getPeriodDurationDays(billingPeriod, count);
  return Math.floor(totalQuota / days);
}
