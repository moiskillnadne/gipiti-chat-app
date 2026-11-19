import type { SubscriptionWithPrices } from "@/lib/billing/subscriptions";
import type { Plan } from "@/server/api/v1/_schemas/plan";

export const toPlanDto = ({
  subscription,
  prices,
}: SubscriptionWithPrices): Plan => ({
  code: subscription.code,
  displayName: subscription.displayName ?? subscription.code,
  billingPeriod: subscription.billingPeriod,
  billingPeriodCount: subscription.billingPeriodCount,
  prices: prices.map(({ currencyCode, price }) => ({
    amountMinor: price,
    currencyCode,
  })),
});
