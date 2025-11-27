import type { SearchDepth } from "@/lib/search/search-types";

export type BillingPeriod = "daily" | "weekly" | "monthly" | "annual";

export type SubscriptionTierConfig = {
  name: string;
  displayName: string;
  billingPeriod: BillingPeriod;
  tokenQuota: number;
  features: {
    maxMessagesPerPeriod?: number;
    allowedModels: string[];
    hasReasoningModels: boolean;
    hasPrioritySupport: boolean;
    maxFileSize: number;
    maxConcurrentChats?: number;
    hasAPIAccess?: boolean;
    searchQuota: number;
    searchDepthAllowed: SearchDepth;
  };
  price: {
    USD: number;
    RUB: number;
  };
  isTesterPlan?: boolean;
};

export const SUBSCRIPTION_TIERS: Record<string, SubscriptionTierConfig> = {
  // TESTER PLAN - Daily reset for easy testing (not for production use)
  tester: {
    name: "tester",
    displayName: "Tester Plan",
    billingPeriod: "daily",
    tokenQuota: 100_000, // 100K tokens per day
    features: {
      maxMessagesPerPeriod: 50, // 50 messages per day
      allowedModels: [
        "gpt-5.1-instant",
        "gpt-5.1-thinking",
        "gemini-3-pro",
        "opus-4.1",
      ],
      hasReasoningModels: true,
      hasPrioritySupport: false,
      maxFileSize: 5 * 1024 * 1024, // 5MB
      maxConcurrentChats: 3,
      hasAPIAccess: false,
      searchQuota: 10, // 10 searches per day
      searchDepthAllowed: "basic",
    },
    price: {
      USD: 0,
      RUB: 0,
    }, // Free for internal testing
    isTesterPlan: true,
  },

  // PAID TESTER PLAN - Daily recurring subscription for testers
  tester_paid: {
    name: "tester_paid",
    displayName: "Tester Plan",
    billingPeriod: "daily",
    tokenQuota: 100_000,
    features: {
      maxMessagesPerPeriod: 50,
      allowedModels: [
        "gpt-5.1-instant",
        "gpt-5.1-thinking",
        "gemini-3-pro",
        "opus-4.1",
      ],
      hasReasoningModels: true,
      hasPrioritySupport: false,
      maxFileSize: 5 * 1024 * 1024,
      maxConcurrentChats: 3,
      hasAPIAccess: false,
      searchQuota: 10,
      searchDepthAllowed: "basic",
    },
    price: {
      USD: 0.05,
      RUB: 5,
    },
    isTesterPlan: true,
  },

  // BASIC PLAN - Entry-level subscription for paywall
  basic_monthly: {
    name: "basic_monthly",
    displayName: "Monthly",
    billingPeriod: "monthly",
    tokenQuota: 1_000_000, // 1M tokens per month
    features: {
      maxMessagesPerPeriod: 500,
      allowedModels: [
        "gpt-5.1-instant",
        "gpt-5.1-thinking",
        "gemini-3-pro",
        "opus-4.1",
      ],
      hasReasoningModels: false,
      hasPrioritySupport: false,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxConcurrentChats: 5,
      hasAPIAccess: false,
      searchQuota: 100, // 100 searches per month
      searchDepthAllowed: "basic",
    },
    price: {
      USD: 19.99,
      RUB: 1999,
    },
  },

  basic_annual: {
    name: "basic_annual",
    displayName: "Annual",
    billingPeriod: "annual",
    tokenQuota: 12_000_000, // 12M tokens per year (1M/month equivalent)
    features: {
      maxMessagesPerPeriod: 6000,
      allowedModels: [
        "gpt-5.1-instant",
        "gpt-5.1-thinking",
        "gemini-3-pro",
        "opus-4.1",
      ],
      hasReasoningModels: true,
      hasPrioritySupport: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxConcurrentChats: 10,
      hasAPIAccess: false,
      searchQuota: 1200, // 1200 searches per year (100/month)
      searchDepthAllowed: "basic",
    },
    price: {
      USD: 149.99,
      RUB: 14_999,
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
 * Helper to get all production tiers (excluding tester)
 */
export function getProductionTiers() {
  return Object.values(SUBSCRIPTION_TIERS).filter((tier) => !tier.isTesterPlan);
}
