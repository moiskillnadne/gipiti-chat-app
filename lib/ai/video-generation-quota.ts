import { getDefaultFreePlanSeed } from "@/lib/ai/entitlements";
import {
  getActiveUserSubscription,
  getVideoGenerationCountByBillingPeriod,
  getVideoGenerationCountByDateRange,
} from "@/lib/db/queries";
import { getUserById } from "@/lib/db/query/user/get-by-id";
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
  const userRecords = await getUserById(userId);
  const userRecord = userRecords[0];

  if (!userRecord) {
    return {
      allowed: false,
      reason: "User not found",
    };
  }

  const planName = userRecord.currentPlan || "free";
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

  // If no limit is configured, disallow by default
  if (limit === undefined || limit === 0) {
    return {
      allowed: false,
      reason: "Video generation is not available on your current plan.",
    };
  }

  // Get user's subscription to determine billing period
  const subscription = await getActiveUserSubscription({ userId });

  if (!subscription) {
    // Free users have one-time cumulative caps — count lifetime, no reset.
    const used = await getVideoGenerationCountByDateRange({
      userId,
      startDate: userRecord.createdAt,
      endDate: new Date(),
    });
    const remaining = Math.max(0, limit - used);
    const noResetSentinel = new Date(8.64e15);

    if (used >= limit) {
      return {
        allowed: false,
        reason:
          "Video generation quota exceeded. " +
          `You've used ${used}/${limit} generations.`,
        quotaInfo: {
          limit,
          used,
          remaining,
          resetAt: noResetSentinel,
          periodType: "lifetime",
        },
      };
    }

    return {
      allowed: true,
      quotaInfo: {
        limit,
        used,
        remaining,
        resetAt: noResetSentinel,
        periodType: "lifetime",
      },
    };
  }

  // Count generations in current billing period
  const used = await getVideoGenerationCountByBillingPeriod({
    userId,
    periodStart: subscription.currentPeriodStart,
    periodEnd: subscription.currentPeriodEnd,
  });
  const remaining = Math.max(0, limit - used);

  if (used >= limit) {
    return {
      allowed: false,
      reason:
        "Video generation quota exceeded. " +
        `You've used ${used}/${limit} generations this ` +
        `${tierConfig.billingPeriod}.`,
      quotaInfo: {
        limit,
        used,
        remaining,
        resetAt: subscription.currentPeriodEnd,
        periodType: tierConfig.billingPeriod,
      },
    };
  }

  return {
    allowed: true,
    quotaInfo: {
      limit,
      used,
      remaining,
      resetAt: subscription.currentPeriodEnd,
      periodType: tierConfig.billingPeriod,
    },
  };
}
