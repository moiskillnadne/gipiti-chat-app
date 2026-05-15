import { getDefaultFreePlanSeed } from "@/lib/ai/entitlements";
import { getBalanceRecord } from "@/lib/ai/token-balance";
import { getActiveUserSubscription } from "@/lib/db/query/subscription/get-active-user-subscription";
import { SUBSCRIPTION_TIERS } from "@/lib/subscription/subscription-tiers";

type VideoGenerationQuotaInfo = {
  limit: number;
  used: number;
  remaining: number;
  resetAt: Date;
  periodType: "daily" | "weekly" | "monthly" | "annual" | "lifetime";
};

type VideoGenerationQuotaCheckResult = {
  allowed: boolean;
  reason?: string;
  quotaInfo?: VideoGenerationQuotaInfo;
};

export async function checkVideoGenerationQuota(
  userId: string
): Promise<VideoGenerationQuotaCheckResult> {
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

  const limit = tierConfig.features.maxVideoGenerationsPerPeriod;

  if (limit === undefined || limit === 0) {
    return {
      allowed: false,
      reason: "Video generation is not available on your current plan.",
    };
  }

  const subscription = await getActiveUserSubscription({ userId });
  const remaining = balanceRow.videoGeneration;
  const used = Math.max(0, limit - remaining);
  const periodType = subscription ? tierConfig.billingPeriod : "lifetime";
  const resetAt = subscription
    ? subscription.currentPeriodEnd
    : new Date(8.64e15);

  if (remaining <= 0) {
    return {
      allowed: false,
      reason: subscription
        ? `Video generation quota exceeded. You've used ${used}/${limit} generations this ${tierConfig.billingPeriod}.`
        : `Video generation quota exceeded. You've used ${used}/${limit} generations.`,
      quotaInfo: { limit, used, remaining, resetAt, periodType },
    };
  }

  return {
    allowed: true,
    quotaInfo: { limit, used, remaining, resetAt, periodType },
  };
}
