export type BillingPeriod = "daily" | "weekly" | "monthly" | "annual";

export type SubscriptionTierConfig = {
  name: string;
  displayName: string;
  billingPeriod: BillingPeriod;
  billingPeriodCount: number;
  tokenQuota: number;
  features: {
    searchQuota: number;
    maxImageGenerationsPerPeriod?: number;
    maxVideoGenerationsPerPeriod?: number;
  };
  price: {
    USD: number;
    RUB: number;
  };
  isTesterPlan?: boolean;
};

// NOTE: The "free" tier is intentionally NOT a member of SUBSCRIPTION_TIERS.
// Free users are on a progressive-unlock model (Tier 1/2/3) defined in
// lib/ai/entitlements.ts. The seed for the DB-level `SubscriptionPlan` row
// used to anchor a free user's `userSubscription` is `getDefaultFreePlanSeed()`
// from that same module.
export const SUBSCRIPTION_TIERS: Record<string, SubscriptionTierConfig> = {
  // PAID TESTER PLAN - Daily recurring subscription for testers
  tester_paid: {
    name: "tester_paid",
    displayName: "Тестовый план [Ежедневный, Платный]",
    billingPeriod: "daily",
    billingPeriodCount: 1,
    tokenQuota: 200_000, // 200K tokens per day
    features: {
      searchQuota: 40, // 40 searches per day
      maxImageGenerationsPerPeriod: 10, // 10 images per day
      maxVideoGenerationsPerPeriod: 5, // 5 videos per day
    },
    price: {
      USD: 0.05,
      RUB: 5,
    },
    isTesterPlan: true,
  },

  // UNLIM PLAN - Manually-assigned only via scripts/assign-unlim-plan.ts.
  // Hidden from UI tier picker (picker hardcodes plan names). Daily reset
  // via reset-quotas cron (which must include "unlim" in its filter).
  unlim: {
    name: "unlim",
    displayName: "БЕЗЛИМИТИЩЕ",
    billingPeriod: "daily",
    billingPeriodCount: 1,
    tokenQuota: 5_000_000, // 5M tokens per day
    features: {
      searchQuota: 200,
      maxImageGenerationsPerPeriod: 100,
      maxVideoGenerationsPerPeriod: 100,
    },
    price: {
      USD: 0,
      RUB: 0,
    },
  },

  // BASIC PLAN - Entry-level subscription for paywall
  basic_monthly: {
    name: "basic_monthly",
    displayName: "Базовый месячный план ",
    billingPeriod: "monthly",
    billingPeriodCount: 1,
    tokenQuota: 3_000_000, // 3M tokens per month
    features: {
      searchQuota: 250, // 250 searches per month
      maxImageGenerationsPerPeriod: 50, // 50 images per month
      maxVideoGenerationsPerPeriod: 5, // 5 videos per month
    },
    price: {
      USD: 19.99,
      RUB: 1999,
    },
  },
} as const;

export type SubscriptionTier = keyof typeof SUBSCRIPTION_TIERS;

/**
 * Helper to get tier by billing period
 */
export function getTiersByBillingPeriod(period: BillingPeriod) {
  return Object.values(SUBSCRIPTION_TIERS).filter(
    (tier) => tier.billingPeriod === period
  );
}

/**
 * Helper to get all production tiers (paid plans, excluding tester).
 * The free plan is handled separately and is not part of SUBSCRIPTION_TIERS.
 */
export function getProductionTiers() {
  return Object.values(SUBSCRIPTION_TIERS).filter((tier) => !tier.isTesterPlan);
}
