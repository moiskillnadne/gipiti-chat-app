import type { SearchDepth } from "@/lib/search/search-types";

export type BillingPeriod = "daily" | "weekly" | "monthly" | "annual";

export type SubscriptionTierConfig = {
  name: string;
  displayName: string;
  billingPeriod: BillingPeriod;
  billingPeriodCount: number;
  tokenQuota: number;
  features: {
    allowedModels: string[];
    hasReasoningModels: boolean;
    hasPrioritySupport: boolean;
    maxFileSize: number;
    maxConcurrentChats?: number;
    hasAPIAccess?: boolean;
    searchQuota: number;
    searchDepthAllowed: SearchDepth;
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
      allowedModels: [
        "gpt-5.1-instant",
        "gpt-5.1-thinking",
        "gpt-5.2",
        "gpt-5.4",
        "gpt-5.4-mini",
        "gpt-5.4-nano",
        "gpt-5.2-pro",
        "gpt-codex-5.2",
        "grok-code-fast-1",
        "gemini-3.1-pro",
        "grok-imagine-image-pro",
        "opus-4.6",
        "sonnet-4.6",
        "veo-3.1",
        "veo-3.1-fast",
        "grok-imagine-video",
        "flux-2-max",
        "flux-kontext-pro",
      ],
      hasReasoningModels: true,
      hasPrioritySupport: false,
      maxFileSize: 5 * 1024 * 1024,
      maxConcurrentChats: 3,
      hasAPIAccess: false,
      searchQuota: 40, // 40 searches per day
      searchDepthAllowed: "advanced",
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
      allowedModels: [
        "gpt-5.1-instant",
        "gpt-5.1-thinking",
        "gpt-5.2",
        "gpt-5.4",
        "gpt-5.4-mini",
        "gpt-5.4-nano",
        "gpt-5.2-pro",
        "gpt-codex-5.2",
        "grok-code-fast-1",
        "gemini-3.1-pro",
        "grok-imagine-image-pro",
        "opus-4.6",
        "sonnet-4.6",
        "veo-3.1",
        "veo-3.1-fast",
        "grok-imagine-video",
        "flux-2-max",
        "flux-kontext-pro",
        "recraft-v4-pro",
      ],
      hasReasoningModels: true,
      hasPrioritySupport: true,
      maxFileSize: 25 * 1024 * 1024, // 25MB
      maxConcurrentChats: 10,
      hasAPIAccess: false,
      searchQuota: 200,
      searchDepthAllowed: "advanced",
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
      allowedModels: [
        "gpt-5.1-instant",
        "gpt-5.1-thinking",
        "gpt-5.2",
        "gpt-5.4",
        "gpt-5.4-mini",
        "gpt-5.4-nano",
        "gpt-5.2-pro",
        "gpt-codex-5.2",
        "grok-code-fast-1",
        "gemini-3.1-pro",
        "grok-imagine-image-pro",
        "opus-4.6",
        "sonnet-4.6",
        "veo-3.1",
        "veo-3.1-fast",
        "grok-imagine-video",
        "flux-2-max",
        "flux-kontext-pro",
        "recraft-v4-pro",
      ],
      hasReasoningModels: true,
      hasPrioritySupport: false,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxConcurrentChats: 5,
      hasAPIAccess: false,
      searchQuota: 250, // 250 searches per month
      searchDepthAllowed: "advanced",
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
