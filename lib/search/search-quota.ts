import { getDefaultFreePlanSeed } from "@/lib/ai/entitlements";
import {
  decrementBalanceCounter,
  ensureBalance,
  getBalanceRecord,
} from "@/lib/ai/token-balance";
import { insertSearchUsageLog } from "@/lib/db/queries";
import { getActiveUserSubscription } from "@/lib/db/query/subscription/get-active-user-subscription";
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
  const balanceRow = await getBalanceRecord(userId);

  if (!balanceRow) {
    return {
      allowed: false,
      reason: "User not found",
      allowedDepth: "basic",
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
      allowedDepth: "basic",
    };
  }

  const subscription = await getActiveUserSubscription({ userId });
  const limit = tierConfig.features.searchQuota;
  const remaining = balanceRow.webSearches;
  const used = Math.max(0, limit - remaining);
  const periodType = subscription ? tierConfig.billingPeriod : "lifetime";
  const resetAt = subscription
    ? subscription.currentPeriodEnd
    : new Date(8.64e15);

  if (remaining <= 0) {
    return {
      allowed: false,
      reason: subscription
        ? `Search quota exceeded. You've used ${used}/${limit} searches this ${tierConfig.billingPeriod}.`
        : `Search quota exceeded. You've used ${used}/${limit} searches.`,
      quotaInfo: {
        limit,
        used,
        remaining,
        resetAt,
        periodType,
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
      resetAt,
      periodType,
    },
    allowedDepth: tierConfig.features.searchDepthAllowed,
  };
}

export async function recordSearchUsage(
  record: SearchUsageRecord
): Promise<void> {
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

  await ensureBalance(record.userId);
  await decrementBalanceCounter({
    userId: record.userId,
    field: "webSearches",
    amount: 1,
  });
}
