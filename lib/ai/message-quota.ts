import {
  getDefaultFreePlanSeed,
  getEntitlements,
  getUserTier,
} from "@/lib/ai/entitlements";
import {
  getActiveUserSubscription,
  getMessageCountByBillingPeriod,
} from "@/lib/db/queries";
import { getUserById } from "@/lib/db/query/user/get-by-id";
import type { BillingPeriod } from "@/lib/subscription/subscription-tiers";
import { SUBSCRIPTION_TIERS } from "@/lib/subscription/subscription-tiers";

type MessageQuotaInfo = {
  limit: number;
  used: number;
  remaining: number;
  resetAt: Date;
  periodType: BillingPeriod | "lifetime";
};

type MessageQuotaCheckResult = {
  allowed: boolean;
  reason?: string;
  quotaInfo?: MessageQuotaInfo;
};

export async function checkMessageQuota(
  userId: string
): Promise<MessageQuotaCheckResult> {
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

  // Free users have a tier-aware lifetime cap (tier_1: 20, tier_2/3: 40).
  // hasSurvey isn't tracked in the DB yet (GIPITI-55 follow-up); default false.
  const limit =
    planName === "free"
      ? getEntitlements(
          getUserTier({ emailVerified: userRecord.emailVerified }, false)
        ).maxMessages
      : tierConfig.features.maxMessagesPerPeriod;

  // If no limit is configured, allow unlimited
  if (limit === undefined) {
    return { allowed: true };
  }

  // Get user's subscription to determine billing period
  const subscription = await getActiveUserSubscription({ userId });

  if (!subscription) {
    // Free users have one-time cumulative caps — count lifetime, no reset.
    const used = await getMessageCountByBillingPeriod({
      userId,
      periodStart: userRecord.createdAt,
      periodEnd: new Date(),
    });
    const remaining = Math.max(0, limit - used);
    const noResetSentinel = new Date(8.64e15);

    if (used >= limit) {
      return {
        allowed: false,
        reason: `Message quota exceeded. You've used ${used}/${limit} messages.`,
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

  // Count messages in current billing period
  const used = await getMessageCountByBillingPeriod({
    userId,
    periodStart: subscription.currentPeriodStart,
    periodEnd: subscription.currentPeriodEnd,
  });
  const remaining = Math.max(0, limit - used);

  if (used >= limit) {
    return {
      allowed: false,
      reason:
        "Message quota exceeded. " +
        `You've used ${used}/${limit} messages this ${tierConfig.billingPeriod}.`,
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
