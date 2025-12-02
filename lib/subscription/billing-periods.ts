import type { BillingPeriod } from "./subscription-tiers";

/**
 * Calculate the next period end date based on billing period type
 */
export function calculatePeriodEnd(
  startDate: Date,
  billingPeriod: BillingPeriod
): Date {
  const endDate = new Date(startDate);

  switch (billingPeriod) {
    case "daily":
      endDate.setDate(endDate.getDate() + 1);
      break;

    case "weekly":
      endDate.setDate(endDate.getDate() + 7);
      break;

    case "monthly":
      // Add one calendar month
      endDate.setMonth(endDate.getMonth() + 1);
      break;

    case "annual":
      // Add one year
      endDate.setFullYear(endDate.getFullYear() + 1);
      break;

    default:
      throw new Error(`Unknown billing period: ${billingPeriod}`);
  }

  return endDate;
}

/**
 * Calculate next billing date (same as period end for most cases)
 */
export function calculateNextBillingDate(
  currentDate: Date,
  billingPeriod: BillingPeriod
): Date {
  return calculatePeriodEnd(currentDate, billingPeriod);
}

/**
 * Check if current period has expired
 */
export function isPeriodExpired(periodEnd: Date): boolean {
  return new Date() >= periodEnd;
}

/**
 * Get period duration in days (approximate for display)
 */
export function getPeriodDurationDays(billingPeriod: BillingPeriod): number {
  switch (billingPeriod) {
    case "daily":
      return 1;
    case "weekly":
      return 7;
    case "monthly":
      return 30;
    case "annual":
      return 365;
    default:
      return 30;
  }
}

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

/**
 * Calculate daily average quota
 */
export function getDailyAverageQuota(
  totalQuota: number,
  billingPeriod: BillingPeriod
): number {
  const days = getPeriodDurationDays(billingPeriod);
  return Math.floor(totalQuota / days);
}
