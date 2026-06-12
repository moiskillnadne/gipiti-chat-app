// Seed source for the Subscription catalog (DB tables Subscription +
// SubscriptionPrice). RUNTIME code must NOT read pricing from here — it reads
// the DB via lib/billing/subscriptions. This module exists only to seed/refresh
// the catalog (scripts/seed-subscriptions.ts).
//
// `code` is the stable identifier sent by CloudPayments as `Data.planName`.
// Prices are in MAJOR currency units (e.g. 999 RUB); the seed converts them to
// minor units. The credited subscription-pool amount equals the price (1:1).
//
// NOTE: the legacy "unlim" plan is not a real subscription in the currency
// model — grant a large balance via scripts/add-balance.ts instead.

export type SeedCurrencyCode = "RUB" | "USD" | "KZT" | "BYN";

export type BillingPeriod = "daily" | "weekly" | "monthly" | "annual";

export type SubscriptionSeed = {
  code: string;
  displayName: string;
  billingPeriod: BillingPeriod;
  billingPeriodCount: number;
  isTester: boolean;
  prices: Partial<Record<SeedCurrencyCode, number>>;
};

export const SUBSCRIPTION_SEEDS: SubscriptionSeed[] = [
  {
    code: "tester_paid",
    displayName: "Тестовый план [Ежедневный, Платный]",
    billingPeriod: "daily",
    billingPeriodCount: 1,
    isTester: true,
    prices: { RUB: 5, USD: 0.05 },
  },
  {
    code: "basic_monthly",
    displayName: "Standard",
    billingPeriod: "monthly",
    billingPeriodCount: 1,
    isTester: false,
    prices: { RUB: 999, USD: 9.99 },
  },
];

export function getSubscriptionSeedByCode(
  code: string
): SubscriptionSeed | undefined {
  return SUBSCRIPTION_SEEDS.find((seed) => seed.code === code);
}
