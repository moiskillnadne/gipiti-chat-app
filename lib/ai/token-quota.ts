import { and, desc, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db/queries";
import {
  subscriptionPlan,
  tokenUsageLog,
  userSubscription,
  userTokenUsage,
} from "@/lib/db/schema";
import type { AppUsage } from "@/lib/usage";
import { isPeriodExpired } from "../subscription/billing-periods";
import type { BillingPeriod } from "../subscription/subscription-tiers";
import {
  checkBalance,
  deductBalance,
  InsufficientBalanceError,
} from "./token-balance";

/**
 * Get user's current subscription and quota information
 */
export async function getUserQuotaInfo(userId: string) {
  // Get active subscription
  const now = new Date();
  const subscriptions = await db
    .select({
      subscription: userSubscription,
      plan: subscriptionPlan,
    })
    .from(userSubscription)
    .innerJoin(
      subscriptionPlan,
      eq(userSubscription.planId, subscriptionPlan.id)
    )
    .where(
      and(
        eq(userSubscription.userId, userId),
        gt(userSubscription.currentPeriodEnd, now),
        eq(userSubscription.status, "active")
      )
    )
    .orderBy(desc(userSubscription.currentPeriodEnd))
    .limit(1);

  if (subscriptions.length === 0) {
    return null;
  }

  const { subscription: sub, plan } = subscriptions[0];

  // Check if period has expired
  if (isPeriodExpired(sub.currentPeriodEnd) && sub.cancelAtPeriodEnd) {
    return null;
  }

  // Get current period usage
  const usages = await db
    .select()
    .from(userTokenUsage)
    .where(
      and(
        eq(userTokenUsage.userId, userId),
        eq(userTokenUsage.subscriptionId, sub.id),
        eq(userTokenUsage.periodStart, sub.currentPeriodStart),
        eq(userTokenUsage.periodEnd, sub.currentPeriodEnd)
      )
    )
    .limit(1);

  const currentUsage = usages[0] || {
    totalTokens: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCost: "0",
    totalRequests: 0,
    modelBreakdown: {},
  };

  const quota = plan.tokenQuota;
  const used = currentUsage.totalTokens || 0;
  const remaining = Math.max(0, quota - used);

  return {
    subscription: sub,
    plan,
    usage: currentUsage,
    quota,
    remaining,
    percentUsed: quota > 0 ? (used / quota) * 100 : 0,
    isExceeded: used >= quota,
  };
}

/**
 * Check if user has available quota (balance-based)
 * Uses the new token balance system
 */
export async function checkTokenQuota(userId: string): Promise<{
  allowed: boolean;
  reason?: string;
  quotaInfo?: Awaited<ReturnType<typeof getUserQuotaInfo>>;
  balanceInfo?: {
    balance: number;
    subscription?: {
      id: string;
      planName: string;
      currentPeriodEnd: Date;
      billingPeriod: string;
    };
  };
}> {
  // Use the new balance-based check
  const balanceCheck = await checkBalance(userId);

  if (!balanceCheck.allowed) {
    // Also get quota info for backward compatibility with error responses
    const quotaInfo = await getUserQuotaInfo(userId);

    return {
      allowed: false,
      reason: balanceCheck.reason,
      quotaInfo,
      balanceInfo: {
        balance: balanceCheck.balance,
        subscription: balanceCheck.subscription,
      },
    };
  }

  return {
    allowed: true,
    balanceInfo: {
      balance: balanceCheck.balance,
      subscription: balanceCheck.subscription,
    },
  };
}

/**
 * Record token usage after API call completes
 * Now uses the balance-based system to deduct tokens
 */
export async function recordTokenUsage({
  userId,
  chatId,
  messageId,
  usage,
}: {
  userId: string;
  chatId?: string;
  messageId?: string;
  usage: AppUsage;
}): Promise<{
  newBalance: number;
  transactionId?: string;
}> {
  const quotaInfo = await getUserQuotaInfo(userId);

  if (!quotaInfo) {
    throw new Error("No active subscription found");
  }

  const { subscription } = quotaInfo;

  // Calculate totals
  const totalTokens = (usage.inputTokens || 0) + (usage.outputTokens || 0);
  const totalCost = ((usage.inputCost || 0) + (usage.outputCost || 0)).toFixed(
    8
  );

  // 1. Deduct from user's token balance atomically
  let deductResult: { newBalance: number; transactionId: string } | undefined;
  try {
    deductResult = await deductBalance({
      userId,
      amount: totalTokens,
      referenceType: "usage",
      referenceId: messageId,
      metadata: {
        modelId: usage.modelId,
        chatId,
        subscriptionId: subscription.id,
      },
    });
  } catch (error) {
    if (error instanceof InsufficientBalanceError) {
      // Log the attempt but continue - the balance was already 0
      console.warn(
        `[recordTokenUsage] Insufficient balance for user ${userId}: ${error.message}`
      );
      deductResult = { newBalance: 0, transactionId: "" };
    } else {
      throw error;
    }
  }

  // 2. Insert into usage log for analytics (keep for historical tracking)
  await db.insert(tokenUsageLog).values({
    userId,
    subscriptionId: subscription.id,
    chatId,
    messageId,
    modelId: usage.modelId || "unknown",
    inputTokens: usage.inputTokens || 0,
    outputTokens: usage.outputTokens || 0,
    totalTokens,
    cacheWriteTokens: usage.cacheWriteTokens || 0,
    cacheReadTokens: usage.cacheReadTokens || 0,
    inputCost: usage.inputCost?.toString(),
    outputCost: usage.outputCost?.toString(),
    totalCost,
    billingPeriodType: subscription.billingPeriod,
    billingPeriodStart: subscription.currentPeriodStart,
    billingPeriodEnd: subscription.currentPeriodEnd,
  });

  // 3. Update aggregate usage (keep for historical analytics)
  await updateUserTokenUsage({
    userId,
    subscriptionId: subscription.id,
    periodStart: subscription.currentPeriodStart,
    periodEnd: subscription.currentPeriodEnd,
    billingPeriodType: subscription.billingPeriod,
    usage,
  });

  return {
    newBalance: deductResult?.newBalance ?? 0,
    transactionId: deductResult?.transactionId,
  };
}

/**
 * Update aggregate usage table (upsert)
 */
async function updateUserTokenUsage({
  userId,
  subscriptionId,
  periodStart,
  periodEnd,
  billingPeriodType,
  usage,
}: {
  userId: string;
  subscriptionId: string;
  periodStart: Date;
  periodEnd: Date;
  billingPeriodType: BillingPeriod;
  usage: AppUsage;
}) {
  const totalTokens = (usage.inputTokens || 0) + (usage.outputTokens || 0);
  const totalCost = (usage.inputCost || 0) + (usage.outputCost || 0);

  // Try to get existing record
  const existing = await db
    .select()
    .from(userTokenUsage)
    .where(
      and(
        eq(userTokenUsage.userId, userId),
        eq(userTokenUsage.periodStart, periodStart),
        eq(userTokenUsage.periodEnd, periodEnd)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    // Update existing
    const record = existing[0];
    const currentModelBreakdown = (record.modelBreakdown || {}) as Record<
      string,
      {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
        cost: number;
        requestCount: number;
      }
    >;
    const modelId = usage.modelId || "unknown";
    const currentModelData = currentModelBreakdown[modelId] || {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      cost: 0,
      requestCount: 0,
    };

    await db
      .update(userTokenUsage)
      .set({
        totalInputTokens:
          (record.totalInputTokens || 0) + (usage.inputTokens || 0),
        totalOutputTokens:
          (record.totalOutputTokens || 0) + (usage.outputTokens || 0),
        totalTokens: (record.totalTokens || 0) + totalTokens,
        totalCost: (
          Number.parseFloat(record.totalCost || "0") + totalCost
        ).toFixed(4),
        totalRequests: (record.totalRequests || 0) + 1,
        lastUpdatedAt: new Date(),
        modelBreakdown: {
          ...currentModelBreakdown,
          [modelId]: {
            inputTokens:
              currentModelData.inputTokens + (usage.inputTokens || 0),
            outputTokens:
              currentModelData.outputTokens + (usage.outputTokens || 0),
            totalTokens: currentModelData.totalTokens + totalTokens,
            cost: currentModelData.cost + totalCost,
            requestCount: currentModelData.requestCount + 1,
          },
        },
      })
      .where(eq(userTokenUsage.id, record.id));
  } else {
    // Insert new
    await db.insert(userTokenUsage).values({
      userId,
      subscriptionId,
      billingPeriodType,
      periodStart,
      periodEnd,
      totalInputTokens: usage.inputTokens || 0,
      totalOutputTokens: usage.outputTokens || 0,
      totalTokens,
      totalCost: totalCost.toFixed(4),
      totalRequests: 1,
      modelBreakdown: {
        [usage.modelId || "unknown"]: {
          inputTokens: usage.inputTokens || 0,
          outputTokens: usage.outputTokens || 0,
          totalTokens,
          cost: totalCost,
          requestCount: 1,
        },
      },
    });
  }
}
