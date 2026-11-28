import type { Plan } from "@/server/api/v1/_schemas/plan";
import type { SubscriptionWithPrices } from "@/server/modules/billing/subscriptions";

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
