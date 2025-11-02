import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/queries";
import {
  subscriptionPlan,
  tokenUsageLog,
  userSubscription,
  userTokenUsage,
} from "@/lib/db/schema";
import type { AppUsage } from "@/lib/usage";
import {
  calculateNextBillingDate,
  calculatePeriodEnd,
  isPeriodExpired,
} from "./billing-periods";
import type { BillingPeriod } from "./subscription-tiers";

/**
 * Get user's current subscription and quota information
 * Automatically renews period if expired
 */
export async function getUserQuotaInfo(userId: string) {
  // Get active subscription
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
        eq(userSubscription.status, "active")
      )
    )
    .orderBy(desc(userSubscription.currentPeriodEnd))
    .limit(1);

  if (subscriptions.length === 0) {
    return null;
  }

  let { subscription: sub, plan } = subscriptions[0];

  // Check if period has expired and auto-renew
  if (isPeriodExpired(sub.currentPeriodEnd)) {
    sub = await renewSubscriptionPeriod(sub);
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
 * Renew subscription period (called when period expires)
 */
async function renewSubscriptionPeriod(
  subscription: typeof userSubscription.$inferSelect
) {
  const newPeriodStart = subscription.currentPeriodEnd;
  const newPeriodEnd = calculatePeriodEnd(
    newPeriodStart,
    subscription.billingPeriod
  );
  const newBillingDate = calculateNextBillingDate(
    newPeriodStart,
    subscription.billingPeriod
  );

  const [updated] = await db
    .update(userSubscription)
    .set({
      currentPeriodStart: newPeriodStart,
      currentPeriodEnd: newPeriodEnd,
      nextBillingDate: newBillingDate,
      updatedAt: new Date(),
    })
    .where(eq(userSubscription.id, subscription.id))
    .returning();

  return updated;
}

/**
 * Check if user has available quota
 */
export async function checkTokenQuota(userId: string): Promise<{
  allowed: boolean;
  reason?: string;
  quotaInfo?: Awaited<ReturnType<typeof getUserQuotaInfo>>;
}> {
  const quotaInfo = await getUserQuotaInfo(userId);

  if (!quotaInfo) {
    return {
      allowed: false,
      reason:
        "No active subscription found. Please subscribe to a plan to continue using the service.",
    };
  }

  if (quotaInfo.isExceeded) {
    const periodLabel = quotaInfo.plan.billingPeriod;
    return {
      allowed: false,
      reason: `Token quota exceeded for this ${periodLabel} period. Used ${quotaInfo.usage.totalTokens.toLocaleString()} / ${quotaInfo.quota.toLocaleString()} tokens. ${
        periodLabel === "daily"
          ? "Your quota will reset tomorrow."
          : `Your quota will reset on ${quotaInfo.subscription.currentPeriodEnd.toLocaleDateString()}.`
      }`,
      quotaInfo,
    };
  }

  return {
    allowed: true,
    quotaInfo,
  };
}

/**
 * Record token usage after API call completes
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
}) {
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

  // Insert into usage log
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

  // Update aggregate usage
  await updateUserTokenUsage({
    userId,
    subscriptionId: subscription.id,
    periodStart: subscription.currentPeriodStart,
    periodEnd: subscription.currentPeriodEnd,
    billingPeriodType: subscription.billingPeriod,
    usage,
  });
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
      any
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
