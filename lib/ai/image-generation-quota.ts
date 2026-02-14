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
  periodType: "daily" | "weekly" | "monthly" | "annual";
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

  const planName = userRecord.currentPlan || "tester";
  const tierConfig = SUBSCRIPTION_TIERS[planName];

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
    // For users without subscription, use daily period
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const used = await getImageGenerationCountByDateRange({
      userId,
      startDate: startOfDay,
      endDate: endOfDay,
    });
    const remaining = Math.max(0, limit - used);

    if (used >= limit) {
      return {
        allowed: false,
        reason:
          "Image generation quota exceeded. " +
          `You've used ${used}/${limit} generations today.`,
        quotaInfo: {
          limit,
          used,
          remaining,
          resetAt: endOfDay,
          periodType: "daily",
        },
      };
    }

    return {
      allowed: true,
      quotaInfo: {
        limit,
        used,
        remaining,
        resetAt: endOfDay,
        periodType: "daily",
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
