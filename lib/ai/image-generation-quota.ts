import { getDefaultFreePlanSeed } from "@/lib/ai/entitlements";
import {
  getActiveUserSubscription,
  getImageGenerationCountByBillingPeriod,
  getImageGenerationCountByDateRange,
} from "@/lib/db/queries";
import { getUserById } from "@/lib/db/query/user/get-by-id";
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

  const limit = tierConfig.features.maxImageGenerationsPerPeriod;

  // If no limit is configured, allow unlimited
  if (limit === undefined) {
    return { allowed: true };
  }

  // Get user's subscription to determine billing period
  const subscription = await getActiveUserSubscription({ userId });

  if (!subscription) {
    // Free users have one-time cumulative caps — count lifetime, no reset.
    const used = await getImageGenerationCountByDateRange({
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
          "Image generation quota exceeded. " +
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
  const used = await getImageGenerationCountByBillingPeriod({
    userId,
    periodStart: subscription.currentPeriodStart,
    periodEnd: subscription.currentPeriodEnd,
  });
  const remaining = Math.max(0, limit - used);

  if (used >= limit) {
    return {
      allowed: false,
      reason:
        "Image generation quota exceeded. " +
        `You've used ${used}/${limit} generations this ${tierConfig.billingPeriod}.`,
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
