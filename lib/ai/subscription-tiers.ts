export type BillingPeriod = "daily" | "weekly" | "monthly" | "annual";

export interface SubscriptionTierConfig {
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
  };
  price: number;
  isTesterPlan?: boolean;
}

export const SUBSCRIPTION_TIERS: Record<string, SubscriptionTierConfig> = {
  // TESTER PLAN - Daily reset for easy testing (not for production use)
  tester: {
    name: "tester",
    displayName: "Tester Plan",
    billingPeriod: "daily",
    tokenQuota: 50_000, // 50K tokens per day
    features: {
      maxMessagesPerPeriod: 50, // 50 messages per day
      allowedModels: ["gpt-5-mini", "grok-2-vision-1212"],
      hasReasoningModels: false,
      hasPrioritySupport: false,
      maxFileSize: 5 * 1024 * 1024, // 5MB
      maxConcurrentChats: 3,
      hasAPIAccess: false,
    },
    price: 0, // Free for internal testing
    isTesterPlan: true,
  },

  // STARTER PLAN - Weekly billing
  starter_weekly: {
    name: "starter_weekly",
    displayName: "Starter Weekly",
    billingPeriod: "weekly",
    tokenQuota: 500_000, // 500K tokens per week (~71K/day)
    features: {
      maxMessagesPerPeriod: 200,
      allowedModels: [
        "gpt-5",
        "gpt-5-mini",
        "grok-2-vision-1212",
        "grok-3-mini",
      ],
      hasReasoningModels: true,
      hasPrioritySupport: false,
      maxFileSize: 20 * 1024 * 1024, // 20MB
      maxConcurrentChats: 10,
      hasAPIAccess: false,
    },
    price: 15,
  },

  starter_monthly: {
    name: "starter_monthly",
    displayName: "Starter Monthly",
    billingPeriod: "monthly",
    tokenQuota: 2_000_000, // 2M tokens per month
    features: {
      maxMessagesPerPeriod: 800,
      allowedModels: [
        "gpt-5",
        "gpt-5-mini",
        "grok-2-vision-1212",
        "grok-3-mini",
      ],
      hasReasoningModels: true,
      hasPrioritySupport: false,
      maxFileSize: 20 * 1024 * 1024,
      maxConcurrentChats: 10,
      hasAPIAccess: false,
    },
    price: 49,
  },

  // PRO PLAN - Monthly and Annual options
  pro_monthly: {
    name: "pro_monthly",
    displayName: "Pro Monthly",
    billingPeriod: "monthly",
    tokenQuota: 10_000_000, // 10M tokens per month
    features: {
      maxMessagesPerPeriod: 5000,
      allowedModels: [
        "gpt-5",
        "gpt-5-pro",
        "gpt-5-mini",
        "grok-2-vision-1212",
        "grok-3-mini",
        "gemini-2.5-pro",
        "claude-opus-4.1",
      ],
      hasReasoningModels: true,
      hasPrioritySupport: true,
      maxFileSize: 50 * 1024 * 1024, // 50MB
      maxConcurrentChats: 50,
      hasAPIAccess: true,
    },
    price: 199,
  },

  pro_annual: {
    name: "pro_annual",
    displayName: "Pro Annual",
    billingPeriod: "annual",
    tokenQuota: 120_000_000, // 120M tokens per year (10M/month equivalent)
    features: {
      maxMessagesPerPeriod: 60000,
      allowedModels: [
        "gpt-5",
        "gpt-5-pro",
        "gpt-5-mini",
        "grok-2-vision-1212",
        "grok-3-mini",
        "gemini-2.5-pro",
        "claude-opus-4.1",
      ],
      hasReasoningModels: true,
      hasPrioritySupport: true,
      maxFileSize: 50 * 1024 * 1024,
      maxConcurrentChats: 50,
      hasAPIAccess: true,
    },
    price: 1990, // ~17% discount vs monthly
  },

  // ENTERPRISE PLAN - High volume usage
  enterprise_monthly: {
    name: "enterprise_monthly",
    displayName: "Enterprise Monthly",
    billingPeriod: "monthly",
    tokenQuota: 50_000_000, // 50M tokens per month
    features: {
      maxMessagesPerPeriod: -1, // Unlimited
      allowedModels: [
        "gpt-5",
        "gpt-5-pro",
        "gpt-5-mini",
        "grok-2-vision-1212",
        "grok-3-mini",
        "gemini-2.5-pro",
        "claude-opus-4.1",
      ],
      hasReasoningModels: true,
      hasPrioritySupport: true,
      maxFileSize: 100 * 1024 * 1024, // 100MB
      maxConcurrentChats: -1, // Unlimited
      hasAPIAccess: true,
    },
    price: 999,
  },

  enterprise_annual: {
    name: "enterprise_annual",
    displayName: "Enterprise Annual",
    billingPeriod: "annual",
    tokenQuota: 600_000_000, // 600M tokens per year
    features: {
      maxMessagesPerPeriod: -1,
      allowedModels: [
        "gpt-5",
        "gpt-5-pro",
        "gpt-5-mini",
        "grok-2-vision-1212",
        "grok-3-mini",
        "gemini-2.5-pro",
        "claude-opus-4.1",
      ],
      hasReasoningModels: true,
      hasPrioritySupport: true,
      maxFileSize: 100 * 1024 * 1024,
      maxConcurrentChats: -1,
      hasAPIAccess: true,
    },
    price: 9990, // ~17% discount
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
  return Object.values(SUBSCRIPTION_TIERS).filter(
    (tier) => !tier.isTesterPlan
  );
}
