import {
  getActiveUserSubscription,
  getSearchUsageCountByBillingPeriod,
  getSearchUsageCountByDateRange,
  getUserById,
  insertSearchUsageLog,
} from "@/lib/db/queries";
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

  const planName = userRecord.currentPlan || "tester";
  const tierConfig = SUBSCRIPTION_TIERS[planName];

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
    // For tester plan users without subscription, use daily period
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const testerUsed = await getSearchUsageCountByDateRange({
      userId,
      startDate: startOfDay,
      endDate: endOfDay,
    });
    const testerLimit = tierConfig.features.searchQuota;
    const testerRemaining = Math.max(0, testerLimit - testerUsed);

    if (testerUsed >= testerLimit) {
      return {
        allowed: false,
        reason: `Search quota exceeded. You've used ${testerUsed}/${testerLimit} searches today.`,
        quotaInfo: {
          limit: testerLimit,
          used: testerUsed,
          remaining: testerRemaining,
          resetAt: endOfDay,
          periodType: "daily",
        },
        allowedDepth: tierConfig.features.searchDepthAllowed,
      };
    }

    return {
      allowed: true,
      quotaInfo: {
        limit: testerLimit,
        used: testerUsed,
        remaining: testerRemaining,
        resetAt: endOfDay,
        periodType: "daily",
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
