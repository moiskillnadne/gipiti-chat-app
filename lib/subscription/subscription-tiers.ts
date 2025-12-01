import type { SearchDepth } from "@/lib/search/search-types";

export type BillingPeriod = "daily" | "weekly" | "monthly" | "annual";

export type SubscriptionTierConfig = {
  name: string;
  displayName: {
    en: string;
    ru: string;
  };
  billingPeriod: BillingPeriod;
  billingPeriodCount: number;
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
    displayName: {
      en: "Tester Plan [Daily, Free]",
      ru: "Тестовый план [Ежедневный, Бесплатный]",
    },
    billingPeriod: "daily",
    billingPeriodCount: 1,
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
    displayName: {
      en: "Tester Plan [Daily, Paid]",
      ru: "Тестовый план [Ежедневный, Платный]",
    },
    billingPeriod: "daily",
    billingPeriodCount: 1,
    tokenQuota: 100_000,
    features: {
      maxMessagesPerPeriod: 10,
      allowedModels: [
        "gpt-5.1-instant",
        "gpt-5.1-thinking",
        "gemini-3-pro",
        "opus-4.1",
      ],
      hasReasoningModels: true,
      hasPrioritySupport: false,
      maxFileSize: 1 * 1024 * 1024, // 1MB
      maxConcurrentChats: 3,
      hasAPIAccess: false,
      searchQuota: 2,
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
    displayName: {
      en: "Basic Monthly Plan",
      ru: "Стандарт в месяц",
    },
    billingPeriod: "monthly",
    billingPeriodCount: 1,
    tokenQuota: 2_000_000, // 2M tokens per month
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

  basic_quarter: {
    name: "basic_quarter",
    displayName: {
      en: "Basic Quarterly Plan",
      ru: "Стандарт в квартал",
    },
    billingPeriod: "monthly",
    billingPeriodCount: 3,
    tokenQuota: 6_000_000, // 6M tokens per quarter (2M/month equivalent)
    features: {
      maxMessagesPerPeriod: 1500,
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
      searchQuota: 300, // 300 searches per quarter (100/month)
      searchDepthAllowed: "basic",
    },
    price: {
      USD: 49.99,
      RUB: 4999,
    },
    isTesterPlan: false,
  },

  basic_annual: {
    name: "basic_annual",
    displayName: {
      en: "Basic Annual Plan",
      ru: "Стандарт в год",
    },
    billingPeriod: "annual",
    billingPeriodCount: 1,
    tokenQuota: 24_000_000, // 24M tokens per year (2M/month equivalent)
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
      USD: 179.99,
      RUB: 17_999,
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
