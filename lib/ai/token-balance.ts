import { and, desc, eq, gt, gte, sql } from "drizzle-orm";
import {
  balance,
  subscriptionPlan,
  tokenBalanceTransaction,
  userSubscription,
} from "@/lib/db/schema";
import { db } from "../db/connection";
import { isPeriodExpired } from "../subscription/billing-periods";

type BalanceCheckResult = {
  allowed: boolean;
  balance: number;
  reason?: string;
  subscription?: {
    id: string;
    planName: string;
    currentPeriodEnd: Date;
    billingPeriod: string;
  };
};

type BalanceModificationResult = {
  success: boolean;
  newBalance: number;
  transactionId: string;
  previousBalance?: number;
};

type TransactionMetadata = {
  modelId?: string;
  chatId?: string;
  planName?: string;
  subscriptionId?: string;
  previousBalance?: number;
};

type CountableField = "imageGeneration" | "videoGeneration" | "webSearches";

const COUNTABLE_FIELDS = {
  imageGeneration: balance.imageGeneration,
  videoGeneration: balance.videoGeneration,
  webSearches: balance.webSearches,
} as const;

/**
 * Fetch the Balance row for a user, if it exists.
 */
export async function getBalanceRecord(userId: string) {
  const [row] = await db
    .select()
    .from(balance)
    .where(eq(balance.userId, userId))
    .limit(1);

  return row ?? null;
}

/**
 * Ensure a Balance row exists for the user. Returns the existing row when
 * present, otherwise inserts a zeroed row with the given plan.
 */
export async function ensureBalance(
  userId: string,
  plan: string | null = null
) {
  const existing = await getBalanceRecord(userId);
  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(balance)
    .values({ userId, plan })
    .onConflictDoNothing({ target: balance.userId })
    .returning();

  if (created) {
    return created;
  }

  // Another writer beat us to it — re-select.
  const row = await getBalanceRecord(userId);
  if (!row) {
    throw new Error(`Failed to ensure balance row for user ${userId}`);
  }
  return row;
}

/**
 * Update the plan name on a user's balance row.
 */
export async function setBalancePlan({
  userId,
  plan,
}: {
  userId: string;
  plan: string | null;
}) {
  await ensureBalance(userId, plan);
  await db
    .update(balance)
    .set({ plan, updatedAt: new Date() })
    .where(eq(balance.userId, userId));
}

/**
 * Atomically decrement a quota counter (imageGeneration / videoGeneration /
 * webSearches). Floors at 0. Returns the new value, or null when the row was
 * missing.
 */
export async function decrementBalanceCounter({
  userId,
  field,
  amount = 1,
}: {
  userId: string;
  field: CountableField;
  amount?: number;
}): Promise<number | null> {
  if (amount <= 0) {
    throw new Error("Decrement amount must be positive");
  }

  const column = COUNTABLE_FIELDS[field];

  const [updated] = await db
    .update(balance)
    .set({
      [field]: sql`GREATEST(0, ${column} - ${amount})`,
      updatedAt: new Date(),
    })
    .where(eq(balance.userId, userId))
    .returning({ value: column });

  return updated?.value ?? null;
}

/**
 * Get user's current token balance and subscription info
 */
export async function getUserBalance(userId: string): Promise<{
  balance: number;
  lastResetAt: Date | null;
  currentPlan: string | null;
  subscription: {
    id: string;
    planId: string;
    planName: string;
    displayName: string | null;
    tokenQuota: number;
    currentPeriodEnd: Date;
    billingPeriod: string;
  } | null;
} | null> {
  const balanceRow = await getBalanceRecord(userId);

  if (!balanceRow) {
    return null;
  }

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

  const subscriptionInfo =
    subscriptions.length > 0
      ? {
          id: subscriptions[0].subscription.id,
          planId: subscriptions[0].plan.id,
          planName: subscriptions[0].plan.name,
          displayName: subscriptions[0].plan.displayName,
          tokenQuota: subscriptions[0].plan.tokenQuota,
          currentPeriodEnd: subscriptions[0].subscription.currentPeriodEnd,
          billingPeriod: subscriptions[0].subscription.billingPeriod,
        }
      : null;

  return {
    balance: balanceRow.tokens,
    lastResetAt: balanceRow.updatedAt,
    currentPlan: balanceRow.plan,
    subscription: subscriptionInfo,
  };
}

/**
 * Check if user has sufficient token balance.
 * This is the pre-flight check before making an API call.
 */
export async function checkBalance(
  userId: string
): Promise<BalanceCheckResult> {
  const balanceInfo = await getUserBalance(userId);

  if (!balanceInfo) {
    return {
      allowed: false,
      balance: 0,
      reason: "User not found.",
    };
  }

  if (!balanceInfo.subscription) {
    if (balanceInfo.currentPlan === "free") {
      if (balanceInfo.balance <= 0) {
        return {
          allowed: false,
          balance: 0,
          reason: "Your free plan tokens are exhausted.",
        };
      }
      return {
        allowed: true,
        balance: balanceInfo.balance,
      };
    }

    const expiredSubs = await db
      .select()
      .from(userSubscription)
      .where(
        and(
          eq(userSubscription.userId, userId),
          eq(userSubscription.cancelAtPeriodEnd, true)
        )
      )
      .limit(1);

    if (
      expiredSubs.length > 0 &&
      isPeriodExpired(expiredSubs[0].currentPeriodEnd)
    ) {
      return {
        allowed: false,
        balance: balanceInfo.balance,
        reason:
          "Your subscription has expired. Please renew to continue using the service.",
      };
    }

    return {
      allowed: false,
      balance: balanceInfo.balance,
      reason:
        "No active subscription found. Please subscribe to a plan to continue using the service.",
    };
  }

  if (balanceInfo.balance <= 0) {
    const periodLabel = balanceInfo.subscription.billingPeriod;
    const resetDate = balanceInfo.subscription.currentPeriodEnd;

    return {
      allowed: false,
      balance: 0,
      reason: `Token balance depleted. ${
        periodLabel === "daily"
          ? "Your balance will reset tomorrow."
          : `Your balance will reset on ${resetDate.toLocaleDateString()}.`
      }`,
      subscription: {
        id: balanceInfo.subscription.id,
        planName: balanceInfo.subscription.planName,
        currentPeriodEnd: resetDate,
        billingPeriod: periodLabel,
      },
    };
  }

  return {
    allowed: true,
    balance: balanceInfo.balance,
    subscription: {
      id: balanceInfo.subscription.id,
      planName: balanceInfo.subscription.planName,
      currentPeriodEnd: balanceInfo.subscription.currentPeriodEnd,
      billingPeriod: balanceInfo.subscription.billingPeriod,
    },
  };
}

/**
 * Atomically deduct tokens from user's balance.
 * Uses PostgreSQL's atomic UPDATE to prevent race conditions.
 */
export async function deductBalance({
  userId,
  amount,
  referenceType,
  referenceId,
  metadata,
}: {
  userId: string;
  amount: number;
  referenceType: string;
  referenceId?: string;
  metadata?: TransactionMetadata;
}): Promise<BalanceModificationResult> {
  if (amount <= 0) {
    throw new Error("Deduction amount must be positive");
  }

  return await db.transaction(async (tx) => {
    const updateResult = await tx
      .update(balance)
      .set({
        tokens: sql`GREATEST(0, ${balance.tokens} - ${amount})`,
        updatedAt: new Date(),
      })
      .where(and(eq(balance.userId, userId), gte(balance.tokens, amount)))
      .returning({
        newBalance: balance.tokens,
      });

    if (updateResult.length === 0) {
      const currentRow = await tx
        .select({ balance: balance.tokens })
        .from(balance)
        .where(eq(balance.userId, userId))
        .limit(1);

      const currentBalance = currentRow[0]?.balance ?? 0;
      const actualDeduction = Math.min(amount, currentBalance);

      if (actualDeduction > 0) {
        await tx
          .update(balance)
          .set({
            tokens: 0,
            updatedAt: new Date(),
          })
          .where(eq(balance.userId, userId));

        const [partialTransaction] = await tx
          .insert(tokenBalanceTransaction)
          .values({
            userId,
            type: "debit",
            amount: -actualDeduction,
            balanceAfter: 0,
            referenceType,
            referenceId,
            description: `Partial deduction (requested: ${amount}, available: ${currentBalance})`,
            metadata: {
              ...metadata,
              previousBalance: currentBalance,
            },
          })
          .returning({ id: tokenBalanceTransaction.id });

        return {
          success: true,
          newBalance: 0,
          transactionId: partialTransaction.id,
          previousBalance: currentBalance,
        };
      }

      throw new InsufficientBalanceError(currentBalance, amount);
    }

    const newBalance = updateResult[0].newBalance;
    const previousBalance = newBalance + amount;

    const [transaction] = await tx
      .insert(tokenBalanceTransaction)
      .values({
        userId,
        type: "debit",
        amount: -amount,
        balanceAfter: newBalance,
        referenceType,
        referenceId,
        metadata: {
          ...metadata,
          previousBalance,
        },
      })
      .returning({ id: tokenBalanceTransaction.id });

    return {
      success: true,
      newBalance,
      transactionId: transaction.id,
      previousBalance,
    };
  });
}

/**
 * Reset user's balance — replaces token balance and optionally refills the
 * quota counters (image / video / search). Used on payments, subscription
 * renewals, and admin resets.
 */
export async function resetBalance({
  userId,
  newBalance,
  imageGeneration,
  videoGeneration,
  webSearches,
  plan,
  reason,
  referenceId,
  planName,
  subscriptionId,
}: {
  userId: string;
  newBalance: number;
  imageGeneration?: number;
  videoGeneration?: number;
  webSearches?: number;
  plan?: string | null;
  reason: "payment" | "subscription_reset" | "admin" | "migration";
  referenceId?: string;
  planName?: string;
  subscriptionId?: string;
}): Promise<BalanceModificationResult> {
  if (newBalance < 0) {
    throw new Error("Balance cannot be negative");
  }

  // Ensure row exists before the transaction so the UPDATE always hits.
  await ensureBalance(userId, plan ?? planName ?? null);

  return await db.transaction(async (tx) => {
    const currentRow = await tx
      .select({ balance: balance.tokens })
      .from(balance)
      .where(eq(balance.userId, userId))
      .limit(1);

    if (currentRow.length === 0) {
      throw new Error("User not found");
    }

    const previousBalance = currentRow[0].balance;

    const updates: Record<string, unknown> = {
      tokens: newBalance,
      updatedAt: new Date(),
    };
    if (imageGeneration !== undefined) {
      updates.imageGeneration = imageGeneration;
    }
    if (videoGeneration !== undefined) {
      updates.videoGeneration = videoGeneration;
    }
    if (webSearches !== undefined) {
      updates.webSearches = webSearches;
    }
    if (plan !== undefined) {
      updates.plan = plan;
    } else if (planName !== undefined) {
      updates.plan = planName;
    }

    await tx.update(balance).set(updates).where(eq(balance.userId, userId));

    const [transaction] = await tx
      .insert(tokenBalanceTransaction)
      .values({
        userId,
        type: "reset",
        amount: newBalance,
        balanceAfter: newBalance,
        referenceType: reason,
        referenceId,
        description: `Balance reset from ${previousBalance} to ${newBalance}`,
        metadata: {
          previousBalance,
          planName,
          subscriptionId,
        },
      })
      .returning({ id: tokenBalanceTransaction.id });

    return {
      success: true,
      newBalance,
      transactionId: transaction.id,
      previousBalance,
    };
  });
}

/**
 * Add tokens to user's existing balance (for top-ups, promos, adjustments).
 */
export async function creditBalance({
  userId,
  amount,
  reason,
  referenceId,
  description,
}: {
  userId: string;
  amount: number;
  reason: "top_up" | "promo" | "adjustment" | "refund";
  referenceId?: string;
  description?: string;
}): Promise<BalanceModificationResult> {
  if (amount <= 0) {
    throw new Error("Credit amount must be positive");
  }

  await ensureBalance(userId);

  return await db.transaction(async (tx) => {
    const currentRow = await tx
      .select({ balance: balance.tokens })
      .from(balance)
      .where(eq(balance.userId, userId))
      .limit(1);

    if (currentRow.length === 0) {
      throw new Error("User not found");
    }

    const previousBalance = currentRow[0].balance;
    const newBalance = previousBalance + amount;

    await tx
      .update(balance)
      .set({
        tokens: newBalance,
        updatedAt: new Date(),
      })
      .where(eq(balance.userId, userId));

    const [transaction] = await tx
      .insert(tokenBalanceTransaction)
      .values({
        userId,
        type: "credit",
        amount,
        balanceAfter: newBalance,
        referenceType: reason,
        referenceId,
        description: description || `Credit: ${amount} tokens`,
        metadata: {
          previousBalance,
        },
      })
      .returning({ id: tokenBalanceTransaction.id });

    return {
      success: true,
      newBalance,
      transactionId: transaction.id,
      previousBalance,
    };
  });
}

/**
 * Get balance transaction history for a user.
 */
export async function getBalanceTransactions({
  userId,
  limit = 50,
  offset = 0,
}: {
  userId: string;
  limit?: number;
  offset?: number;
}) {
  const transactions = await db
    .select()
    .from(tokenBalanceTransaction)
    .where(eq(tokenBalanceTransaction.userId, userId))
    .orderBy(desc(tokenBalanceTransaction.createdAt))
    .limit(limit)
    .offset(offset);

  return transactions;
}

export class InsufficientBalanceError extends Error {
  readonly currentBalance: number;
  readonly requestedAmount: number;

  constructor(currentBalance: number, requestedAmount: number) {
    super(
      `Insufficient token balance. Current: ${currentBalance}, Requested: ${requestedAmount}`
    );
    this.name = "InsufficientBalanceError";
    this.currentBalance = currentBalance;
    this.requestedAmount = requestedAmount;
  }
}

export function formatTokenBalance(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1000) {
    return `${Math.round(tokens / 1000)}K`;
  }
  return tokens.toLocaleString();
}
