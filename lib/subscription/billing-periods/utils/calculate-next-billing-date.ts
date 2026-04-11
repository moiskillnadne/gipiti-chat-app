import type { BillingPeriod } from "../../subscription-tiers";
import { calculatePeriodEnd } from "./calculate-period-end";

/**
 * Calculate next billing date (same as period end for most cases)
 */
export function calculateNextBillingDate(
  currentDate: Date,
  billingPeriod: BillingPeriod,
  count = 1
): Date {
  return calculatePeriodEnd(currentDate, billingPeriod, count);
}
