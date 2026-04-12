import type { BillingPeriod } from "../../subscription-tiers";

/**
 * Calculate the next period end date based on billing period type and count
 */
export function calculatePeriodEnd(
  startDate: Date,
  billingPeriod: BillingPeriod,
  count = 1
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
