import type { SubscriptionTierConfig } from "./subscription-tiers";

type RefillValues = {
  newBalance: number;
  imageGeneration: number;
  videoGeneration: number;
  webSearches: number;
};

/**
 * Build the balance-refill payload for a subscription tier. Used by payment
 * webhooks, recurrent payments, cron renewals, and subscription init.
 */
export function buildRefillFromTier(
  tier: SubscriptionTierConfig
): RefillValues {
  return {
    newBalance: tier.tokenQuota,
    imageGeneration: tier.features.maxImageGenerationsPerPeriod ?? 0,
    videoGeneration: tier.features.maxVideoGenerationsPerPeriod ?? 0,
    webSearches: tier.features.searchQuota,
  };
}
