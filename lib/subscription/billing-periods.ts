import type { BillingPeriod } from "./subscription-tiers";

/**
 * Calculate the next period end date based on billing period type and count
 */
export function calculatePeriodEnd(
  startDate: Date,
  billingPeriod: BillingPeriod,
  count: number = 1
): Date {
  const endDate = new Date(startDate);

  switch (billingPeriod) {
    case "daily":
      endDate.setDate(endDate.getDate() + count);
      break;

    case "weekly":
      endDate.setDate(endDate.getDate() + 7 * count);
      break;

    case "monthly":
      endDate.setMonth(endDate.getMonth() + count);
      break;

    case "annual":
      endDate.setFullYear(endDate.getFullYear() + count);
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
  billingPeriod: BillingPeriod,
  count: number = 1
): Date {
  return calculatePeriodEnd(currentDate, billingPeriod, count);
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
export function getPeriodDurationDays(
  billingPeriod: BillingPeriod,
  count: number = 1
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
 * Get period label with count for display (e.g., "per quarter" for monthly × 3)
 */
export function getPeriodLabelWithCount(
  billingPeriod: BillingPeriod,
  count: number = 1
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

/**
 * Calculate daily average quota
 */
export function getDailyAverageQuota(
  totalQuota: number,
  billingPeriod: BillingPeriod,
  count: number = 1
): number {
  const days = getPeriodDurationDays(billingPeriod, count);
  return Math.floor(totalQuota / days);
}
