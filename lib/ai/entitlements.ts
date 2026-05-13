import type { UserType } from "@/app/(auth)/auth";
import type { SearchDepth } from "@/lib/search/search-types";
import type { ChatModel } from "./models";
import { chatModels, isVisibleInUI } from "./models";

type Entitlements = {
  maxMessagesPerDay: number;
  availableChatModelIds: ChatModel["id"][];
};

export const entitlementsByUserType: Record<UserType, Entitlements> = {
  /*
   * For users with an account
   */
  regular: {
    maxMessagesPerDay: 100,
    availableChatModelIds: [
      "chat-model",
      "chat-model-reasoning",
      "grok-4.1-reasoning",
      "grok-4.1-non-reasoning",
      "grok-code-fast-1",
      "gpt-5",
      "gpt-5.1-instant",
      "gpt-5.1-thinking",
      "gpt-5.2",
      "gpt-5.4",
      "gpt-5.4-mini",
      "gpt-5.4-nano",
      "gpt-5.2-pro",
      "gemini-3.1-pro",
      "gemini-3-pro-image",
      "gemini-3.1-flash-image",
      "grok-imagine-image-pro",
      "gpt-image-1.5",
      "opus-4.6",
      "sonnet-4.6",
      "gpt-codex-5.2",
      "veo-3.1",
      "veo-3.1-fast",
      "grok-imagine-video",
      "flux-2-max",
      "flux-kontext-pro",
      "recraft-v4-pro",
    ],
  },

  /*
   * TODO: For users with an account and a paid membership
   */
};

// =============================================================================
// Free-tier progressive unlock (GIPITI-55)
// =============================================================================
//
// The "free plan" is NOT a subscription tier. It's a derived state with three
// progressive levels, each unlocked by completing a profile milestone:
//   tier_1: just signed up
//   tier_2: email verified
//   tier_3: onboarding survey completed (requires email verified first)
//
// allowedModels is cumulative — higher tiers include everything from lower
// tiers. tokenBonus / imageBonus / videoBonus are DELTAS granted on reaching
// that tier (the caller credits these to the user's balance; we don't know
// the user's existing balance here).

export type FreeTier = "tier_1" | "tier_2" | "tier_3";

export type FreeTierEntitlements = {
  tier: FreeTier;
  allowedModels: ChatModel["id"][];
  tokenBonus: number;
  imageBonus: number;
  videoBonus: number;
  searchQuota: number;
  searchDepthAllowed: SearchDepth;
  // Absolute lifetime cap on user-messages for a free user at this tier.
  // Not a delta — represents the total allowance once the tier is reached.
  maxMessages: number;
};

const TIER_1_MODELS: ChatModel["id"][] = ["gpt-5.4-mini", "gpt-5.4-nano"];

const TIER_2_ADDITIONAL_MODELS: ChatModel["id"][] = [
  "sonnet-4.6",
  "gemini-3.1-flash-image",
  "gemini-3.1-pro",
  "gpt-5.4",
];

const TIER_2_MODELS: ChatModel["id"][] = [
  ...TIER_1_MODELS,
  ...TIER_2_ADDITIONAL_MODELS,
];

// Tier 3 unlocks everything else in the visible catalog.
const TIER_3_MODELS: ChatModel["id"][] = (() => {
  const tier2 = new Set<string>(TIER_2_MODELS);
  const catalog = chatModels
    .filter((model) => isVisibleInUI(model.id))
    .map((model) => model.id);
  for (const id of catalog) {
    tier2.add(id);
  }
  return Array.from(tier2);
})();

export const FREE_TIER_ENTITLEMENTS: Record<FreeTier, FreeTierEntitlements> = {
  tier_1: {
    tier: "tier_1",
    allowedModels: TIER_1_MODELS,
    tokenBonus: 10_000,
    imageBonus: 0,
    videoBonus: 0,
    searchQuota: 2,
    searchDepthAllowed: "basic",
    maxMessages: 20,
  },
  tier_2: {
    tier: "tier_2",
    allowedModels: TIER_2_MODELS,
    tokenBonus: 10_000,
    imageBonus: 1,
    videoBonus: 0,
    searchQuota: 5,
    searchDepthAllowed: "basic",
    maxMessages: 40,
  },
  tier_3: {
    tier: "tier_3",
    allowedModels: TIER_3_MODELS,
    tokenBonus: 20_000,
    imageBonus: 2,
    videoBonus: 1,
    searchQuota: 5,
    searchDepthAllowed: "basic",
    maxMessages: 40,
  },
};

export function getEntitlements(tier: FreeTier): FreeTierEntitlements {
  return FREE_TIER_ENTITLEMENTS[tier];
}

export type FreeTierDerivationInput = {
  emailVerified: boolean;
  hasCompletedOnboardingSurvey: boolean;
};

// Email verification is the floor for any unlock beyond tier_1. A completed
// survey without a verified email cannot promote past tier_1.
export function deriveFreeTier({
  emailVerified,
  hasCompletedOnboardingSurvey,
}: FreeTierDerivationInput): FreeTier {
  if (!emailVerified) {
    return "tier_1";
  }
  if (hasCompletedOnboardingSurvey) {
    return "tier_3";
  }
  return "tier_2";
}

export type GetUserTierInput = {
  emailVerified: boolean;
};

// Pure helper — derives a user's free tier from their state. No DB access.
// Accepts a minimal user shape so it can be called with the session user,
// the DB user, or any partial object that exposes `emailVerified`.
export function getUserTier(
  user: GetUserTierInput,
  hasSurvey: boolean
): FreeTier {
  return deriveFreeTier({
    emailVerified: user.emailVerified,
    hasCompletedOnboardingSurvey: hasSurvey,
  });
}

// Seed used by `assignFreePlan` and migration scripts when they need to
// create or update the `SubscriptionPlan` DB row for free users. The free
// plan is not part of `SUBSCRIPTION_TIERS`, so this is the single source of
// truth for what a fresh free user looks like at the storage layer.
//
// `billingPeriod` here is a storage-layer detail (the DB column is non-null
// and the postgres enum has no "lifetime" value). The actual quota model
// is one-time and refresh is suppressed by the reset-quotas cron filter.
export type FreePlanSeed = {
  name: "free";
  displayName: string;
  billingPeriod: "daily";
  billingPeriodCount: number;
  tokenQuota: number;
  features: {
    maxMessagesPerPeriod?: number;
    allowedModels: ChatModel["id"][];
    hasReasoningModels: boolean;
    hasPrioritySupport: boolean;
    maxFileSize: number;
    maxConcurrentChats?: number;
    hasAPIAccess?: boolean;
    searchQuota: number;
    searchDepthAllowed: SearchDepth;
    maxImageGenerationsPerPeriod: number;
    maxVideoGenerationsPerPeriod: number;
  };
  price: {
    USD: number;
    RUB: number;
  };
};

export function getDefaultFreePlanSeed(): FreePlanSeed {
  const tier1 = FREE_TIER_ENTITLEMENTS.tier_1;
  return {
    name: "free",
    displayName: "Бесплатный план",
    billingPeriod: "daily",
    billingPeriodCount: 1,
    tokenQuota: tier1.tokenBonus,
    features: {
      allowedModels: tier1.allowedModels,
      hasReasoningModels: false,
      hasPrioritySupport: false,
      maxFileSize: 2 * 1024 * 1024,
      maxConcurrentChats: 1,
      hasAPIAccess: false,
      searchQuota: tier1.searchQuota,
      searchDepthAllowed: tier1.searchDepthAllowed,
      maxImageGenerationsPerPeriod: tier1.imageBonus,
      maxVideoGenerationsPerPeriod: tier1.videoBonus,
      maxMessagesPerPeriod: tier1.maxMessages,
    },
    price: {
      USD: 0,
      RUB: 0,
    },
  };
}
