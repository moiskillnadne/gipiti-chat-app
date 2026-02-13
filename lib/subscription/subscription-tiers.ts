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
    maxImageGenerationsPerPeriod?: number;
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
    tokenQuota: 200_000, // 200K tokens per day
    features: {
      maxMessagesPerPeriod: 100, // 100 messages per day
      allowedModels: [
        "gpt-5.1-instant",
        "gpt-5.1-thinking",
        "gpt-5.2",
        "gpt-5.2-pro",
        "gpt-codex-5.2",
        "grok-code-fast-1",
        "gemini-3-pro",
        "opus-4.6",
        "sonnet-4.5",
      ],
      hasReasoningModels: true,
      hasPrioritySupport: false,
      maxFileSize: 5 * 1024 * 1024, // 5MB
      maxConcurrentChats: 3,
      hasAPIAccess: false,
      searchQuota: 40, // 40 searches per day
      searchDepthAllowed: "advanced",
      maxImageGenerationsPerPeriod: 10, // 10 images per day
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
    tokenQuota: 200_000, // 200K tokens per day
    features: {
      maxMessagesPerPeriod: 100, // 100 messages per day
      allowedModels: [
        "gpt-5.1-instant",
        "gpt-5.1-thinking",
        "gpt-5.2",
        "gpt-5.2-pro",
        "gpt-codex-5.2",
        "grok-code-fast-1",
        "gemini-3-pro",
        "opus-4.6",
        "sonnet-4.5",
      ],
      hasReasoningModels: true,
      hasPrioritySupport: false,
      maxFileSize: 5 * 1024 * 1024,
      maxConcurrentChats: 3,
      hasAPIAccess: false,
      searchQuota: 40, // 40 searches per day
      searchDepthAllowed: "advanced",
      maxImageGenerationsPerPeriod: 10, // 10 images per day
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
      ru: "Базовый месячный план ",
    },
    billingPeriod: "monthly",
    billingPeriodCount: 1,
    tokenQuota: 3_000_000, // 3M tokens per month
    features: {
      maxMessagesPerPeriod: 1500,
      allowedModels: [
        "gpt-5.1-instant",
        "gpt-5.1-thinking",
        "gpt-5.2",
        "gpt-5.2-pro",
        "gpt-codex-5.2",
        "grok-code-fast-1",
        "gemini-3-pro",
        "opus-4.6",
        "sonnet-4.5",
      ],
      hasReasoningModels: true,
      hasPrioritySupport: false,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxConcurrentChats: 5,
      hasAPIAccess: false,
      searchQuota: 250, // 250 searches per month
      searchDepthAllowed: "advanced",
      maxImageGenerationsPerPeriod: 50, // 50 images per month
    },
    price: {
      USD: 19.99,
      RUB: 1999,
    },
  },

  // QUARTERLY PLAN - 3-month subscription
  basic_quarterly: {
    name: "basic_quarterly",
    displayName: {
      en: "Basic Quarterly Plan",
      ru: "Базовый квартальный план",
    },
    billingPeriod: "monthly",
    billingPeriodCount: 3,
    tokenQuota: 9_000_000, // 9M tokens per quarter (3M/month equivalent)
    features: {
      maxMessagesPerPeriod: 4500,
      allowedModels: [
        "gpt-5.1-instant",
        "gpt-5.1-thinking",
        "gpt-5.2",
        "gpt-5.2-pro",
        "gpt-codex-5.2",
        "grok-code-fast-1",
        "gemini-3-pro",
        "opus-4.6",
        "sonnet-4.5",
      ],
      hasReasoningModels: true,
      hasPrioritySupport: false,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxConcurrentChats: 5,
      hasAPIAccess: false,
      searchQuota: 750, // 750 searches per quarter (250/month)
      searchDepthAllowed: "advanced",
      maxImageGenerationsPerPeriod: 150, // 150 images per quarter
    },
    price: {
      USD: 49.99,
      RUB: 4999,
    },
  },

  basic_annual: {
    name: "basic_annual",
    displayName: {
      en: "Basic Annual Plan",
      ru: "Базовый годовой план",
    },
    billingPeriod: "annual",
    billingPeriodCount: 1,
    tokenQuota: 36_000_000, // 36M tokens per year (3M/month equivalent)
    features: {
      maxMessagesPerPeriod: 18_000,
      allowedModels: [
        "gpt-5.1-instant",
        "gpt-5.1-thinking",
        "gpt-5.2",
        "gpt-5.2-pro",
        "gpt-codex-5.2",
        "grok-code-fast-1",
        "gemini-3-pro",
        "opus-4.6",
        "sonnet-4.5",
      ],
      hasReasoningModels: true,
      hasPrioritySupport: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxConcurrentChats: 10,
      hasAPIAccess: false,
      searchQuota: 3000, // 3000 searches per year (250/month)
      searchDepthAllowed: "advanced",
      maxImageGenerationsPerPeriod: 600, // 600 images per year
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
