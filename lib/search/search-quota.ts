import { getDefaultFreePlanSeed } from "@/lib/ai/entitlements";
import {
  getActiveUserSubscription,
  getCurrentPlan,
  getSearchUsageCountByBillingPeriod,
  getSearchUsageCountByDateRange,
  insertSearchUsageLog,
} from "@/lib/db/queries";
import { getUserById } from "@/lib/db/query/user/get-by-id";
import { SUBSCRIPTION_TIERS } from "@/lib/subscription/subscription-tiers";
import type {
  SearchDepth,
  SearchQuotaInfo,
  SearchUsageRecord,
} from "./search-types";

type SearchQuotaCheckResult = {
  allowed: boolean;
  reason?: string;
  quotaInfo?: SearchQuotaInfo;
  allowedDepth: SearchDepth;
};

export async function checkSearchQuota(
  userId: string
): Promise<SearchQuotaCheckResult> {
  // Get user's current plan
  const userRecords = await getUserById(userId);

  const userRecord = userRecords[0];

  if (!userRecord) {
    return {
      allowed: false,
      reason: "User not found",
      allowedDepth: "basic",
    };
  }

  const planName = (await getCurrentPlan(userId)) || "free";
  const tierConfig =
    planName === "free"
      ? getDefaultFreePlanSeed()
      : SUBSCRIPTION_TIERS[planName];

  if (!tierConfig) {
    return {
      allowed: false,
      reason: "Invalid subscription plan",
      allowedDepth: "basic",
    };
  }

  // Get user's subscription to determine billing period
  const subscription = await getActiveUserSubscription({ userId });

  if (!subscription) {
    // Free users have one-time cumulative quotas — counted lifetime, no reset.
    const lifetimeUsed = await getSearchUsageCountByDateRange({
      userId,
      startDate: userRecord.createdAt,
      endDate: new Date(),
    });
    const lifetimeLimit = tierConfig.features.searchQuota;
    const lifetimeRemaining = Math.max(0, lifetimeLimit - lifetimeUsed);
    // Free quotas are one-time; surface `resetAt` as far in the future so any
    // consumer reading it doesn't promise an imminent refresh.
    const noResetSentinel = new Date(8.64e15);

    if (lifetimeUsed >= lifetimeLimit) {
      return {
        allowed: false,
        reason: `Search quota exceeded. You've used ${lifetimeUsed}/${lifetimeLimit} searches.`,
        quotaInfo: {
          limit: lifetimeLimit,
          used: lifetimeUsed,
          remaining: lifetimeRemaining,
          resetAt: noResetSentinel,
          periodType: "lifetime",
        },
        allowedDepth: tierConfig.features.searchDepthAllowed,
      };
    }

    return {
      allowed: true,
      quotaInfo: {
        limit: lifetimeLimit,
        used: lifetimeUsed,
        remaining: lifetimeRemaining,
        resetAt: noResetSentinel,
        periodType: "lifetime",
      },
      allowedDepth: tierConfig.features.searchDepthAllowed,
    };
  }

  // Count searches in current billing period
  const used = await getSearchUsageCountByBillingPeriod({
    userId,
    periodStart: subscription.currentPeriodStart,
    periodEnd: subscription.currentPeriodEnd,
  });
  const limit = tierConfig.features.searchQuota;
  const remaining = Math.max(0, limit - used);

  if (used >= limit) {
    return {
      allowed: false,
      reason: `Search quota exceeded. You've used ${used}/${limit} searches this ${tierConfig.billingPeriod}.`,
      quotaInfo: {
        limit,
        used,
        remaining,
        resetAt: subscription.currentPeriodEnd,
        periodType: tierConfig.billingPeriod,
      },
      allowedDepth: tierConfig.features.searchDepthAllowed,
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
    allowedDepth: tierConfig.features.searchDepthAllowed,
  };
}

export async function recordSearchUsage(
  record: SearchUsageRecord
): Promise<void> {
  // Get user's subscription to determine billing period
  const subscription = await getActiveUserSubscription({
    userId: record.userId,
  });

  let billingPeriodStart: Date;
  let billingPeriodEnd: Date;
  let billingPeriodType: "daily" | "weekly" | "monthly" | "annual";

  if (subscription) {
    billingPeriodStart = subscription.currentPeriodStart;
    billingPeriodEnd = subscription.currentPeriodEnd;
    billingPeriodType = subscription.billingPeriod;
  } else {
    // Default to daily for tester plan
    const now = new Date();
    billingPeriodStart = new Date(now);
    billingPeriodStart.setHours(0, 0, 0, 0);
    billingPeriodEnd = new Date(now);
    billingPeriodEnd.setHours(23, 59, 59, 999);
    billingPeriodType = "daily";
  }

  await insertSearchUsageLog({
    userId: record.userId,
    chatId: record.chatId ?? null,
    query: record.query,
    searchDepth: record.searchDepth,
    resultsCount: record.resultsCount,
    responseTimeMs: record.responseTimeMs,
    cached: record.cached,
    billingPeriodType,
    billingPeriodStart,
    billingPeriodEnd,
  });
}
