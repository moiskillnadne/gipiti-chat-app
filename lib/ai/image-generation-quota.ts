import { getDefaultFreePlanSeed } from "@/lib/ai/entitlements";
import { getBalanceRecord } from "@/lib/ai/token-balance";
import { getActiveUserSubscription } from "@/lib/db/queries";
import { SUBSCRIPTION_TIERS } from "@/lib/subscription/subscription-tiers";

type ImageGenerationQuotaInfo = {
  limit: number;
  used: number;
  remaining: number;
  resetAt: Date;
  periodType: "daily" | "weekly" | "monthly" | "annual" | "lifetime";
};

type ImageGenerationQuotaCheckResult = {
  allowed: boolean;
  reason?: string;
  quotaInfo?: ImageGenerationQuotaInfo;
};

export async function checkImageGenerationQuota(
  userId: string
): Promise<ImageGenerationQuotaCheckResult> {
  const balanceRow = await getBalanceRecord(userId);

  if (!balanceRow) {
    return {
      allowed: false,
      reason: "User not found",
    };
  }

  const planName = balanceRow.plan || "free";
  const tierConfig =
    planName === "free"
      ? getDefaultFreePlanSeed()
      : SUBSCRIPTION_TIERS[planName];

  if (!tierConfig) {
    return {
      allowed: false,
      reason: "Invalid subscription plan",
    };
  }

  const limit = tierConfig.features.maxImageGenerationsPerPeriod;

  if (limit === undefined) {
    return { allowed: true };
  }

  const subscription = await getActiveUserSubscription({ userId });
  const remaining = balanceRow.imageGeneration;
  const used = Math.max(0, limit - remaining);
  const periodType = subscription ? tierConfig.billingPeriod : "lifetime";
  const resetAt = subscription
    ? subscription.currentPeriodEnd
    : new Date(8.64e15);

  if (remaining <= 0) {
    return {
      allowed: false,
      reason: subscription
        ? `Image generation quota exceeded. You've used ${used}/${limit} generations this ${tierConfig.billingPeriod}.`
        : `Image generation quota exceeded. You've used ${used}/${limit} generations.`,
      quotaInfo: { limit, used, remaining, resetAt, periodType },
    };
  }

  return {
    allowed: true,
    quotaInfo: { limit, used, remaining, resetAt, periodType },
  };
}
