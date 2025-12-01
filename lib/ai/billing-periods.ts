import type { BillingPeriod } from "../subscription/subscription-tiers";

/**
 * Calculate the next period end date based on billing period type and count
 */
export function calculatePeriodEnd(
  startDate: Date,
  billingPeriod: BillingPeriod,
  billingPeriodCount = 1
): Date {
  const endDate = new Date(startDate);

  switch (billingPeriod) {
    case "daily":
      endDate.setDate(endDate.getDate() + billingPeriodCount);
      break;

    case "weekly":
      endDate.setDate(endDate.getDate() + 7 * billingPeriodCount);
      break;

    case "monthly":
      endDate.setMonth(endDate.getMonth() + billingPeriodCount);
      break;

    case "annual":
      endDate.setFullYear(endDate.getFullYear() + billingPeriodCount);
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
  billingPeriodCount = 1
): Date {
  return calculatePeriodEnd(currentDate, billingPeriod, billingPeriodCount);
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
  billingPeriodCount = 1
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
  return baseDays * billingPeriodCount;
}

/**
 * Get period label for display
 */
export function getPeriodLabel(
  billingPeriod: BillingPeriod,
  billingPeriodCount = 1
): string {
  if (billingPeriod === "monthly" && billingPeriodCount === 3) {
    return "per quarter";
  }

  if (billingPeriodCount > 1) {
    switch (billingPeriod) {
      case "daily":
        return `per ${billingPeriodCount} days`;
      case "weekly":
        return `per ${billingPeriodCount} weeks`;
      case "monthly":
        return `per ${billingPeriodCount} months`;
      case "annual":
        return `per ${billingPeriodCount} years`;
      default:
        return "per period";
    }
  }

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
  billingPeriod: BillingPeriod,
  billingPeriodCount = 1
): number {
  const days = getPeriodDurationDays(billingPeriod, billingPeriodCount);
  return Math.floor(totalQuota / days);
}
