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
  periodType: "daily" | "weekly" | "monthly" | "annual";
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

  const planName = userRecord.currentPlan || "tester";
  const tierConfig = SUBSCRIPTION_TIERS[planName];

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
    // For users without subscription, use daily period
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const used = await getVideoGenerationCountByDateRange({
      userId,
      startDate: startOfDay,
      endDate: endOfDay,
    });
    const remaining = Math.max(0, limit - used);

    if (used >= limit) {
      return {
        allowed: false,
        reason:
          "Video generation quota exceeded. " +
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
