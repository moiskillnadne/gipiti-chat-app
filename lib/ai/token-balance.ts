import { and, desc, eq, gt, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db/queries";
import {
  subscriptionPlan,
  tokenBalanceTransaction,
  user,
  userSubscription,
} from "@/lib/db/schema";
import { isPeriodExpired } from "../subscription/billing-periods";

/**
 * Result of a balance check operation
 */
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

/**
 * Result of a balance modification operation
 */
type BalanceModificationResult = {
  success: boolean;
  newBalance: number;
  transactionId: string;
  previousBalance?: number;
};

/**
 * Metadata for balance transactions
 */
type TransactionMetadata = {
  modelId?: string;
  chatId?: string;
  planName?: string;
  subscriptionId?: string;
  previousBalance?: number;
};

/**
 * Get user's current token balance and subscription info
 */
export async function getUserBalance(userId: string): Promise<{
  balance: number;
  lastResetAt: Date | null;
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
  // Get user with balance
  const users = await db
    .select({
      tokenBalance: user.tokenBalance,
      lastBalanceResetAt: user.lastBalanceResetAt,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (users.length === 0) {
    return null;
  }

  const { tokenBalance, lastBalanceResetAt } = users[0];

  // Get active subscription for additional context
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
    balance: tokenBalance,
    lastResetAt: lastBalanceResetAt,
    subscription: subscriptionInfo,
  };
}

/**
 * Check if user has sufficient token balance
 * This is the pre-flight check before making an API call
 */
export async function checkBalance(
  userId: string
): Promise<BalanceCheckResult> {
  // Get user balance and subscription info
  const balanceInfo = await getUserBalance(userId);

  if (!balanceInfo) {
    return {
      allowed: false,
      balance: 0,
      reason: "User not found.",
    };
  }

  // Check for active subscription
  if (!balanceInfo.subscription) {
    // Check if there's a cancelled subscription with expired period
    const now = new Date();
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

  // Check if balance is depleted
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
 * Atomically deduct tokens from user's balance
 * Uses PostgreSQL's atomic UPDATE with conditional WHERE clause to prevent race conditions
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

  // Use a transaction to ensure atomicity
  return await db.transaction(async (tx) => {
    // Atomically update balance if sufficient funds
    // GREATEST(0, ...) ensures we never go below 0
    const updateResult = await tx
      .update(user)
      .set({
        tokenBalance: sql`GREATEST(0, ${user.tokenBalance} - ${amount})`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(user.id, userId),
          gte(user.tokenBalance, amount) // Only deduct if sufficient balance
        )
      )
      .returning({
        newBalance: user.tokenBalance,
      });

    if (updateResult.length === 0) {
      // Insufficient balance - get current balance for error context
      const currentUser = await tx
        .select({ balance: user.tokenBalance })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);

      const currentBalance = currentUser[0]?.balance ?? 0;

      // Still record the deduction attempt with actual deducted amount
      // This creates a transaction showing we hit the floor
      const actualDeduction = Math.min(amount, currentBalance);

      if (actualDeduction > 0) {
        // Deduct whatever is available
        await tx
          .update(user)
          .set({
            tokenBalance: 0,
            updatedAt: new Date(),
          })
          .where(eq(user.id, userId));

        // Record partial deduction transaction
        const [transaction] = await tx
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
          transactionId: transaction.id,
          previousBalance: currentBalance,
        };
      }

      // No balance to deduct
      throw new InsufficientBalanceError(currentBalance, amount);
    }

    const newBalance = updateResult[0].newBalance;
    const previousBalance = newBalance + amount;

    // Record the transaction
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
 * Reset user's balance to a new value (called by payment webhooks)
 * This replaces the current balance with the new value
 */
export async function resetBalance({
  userId,
  newBalance,
  reason,
  referenceId,
  planName,
  subscriptionId,
}: {
  userId: string;
  newBalance: number;
  reason: "payment" | "subscription_reset" | "admin" | "migration";
  referenceId?: string;
  planName?: string;
  subscriptionId?: string;
}): Promise<BalanceModificationResult> {
  if (newBalance < 0) {
    throw new Error("Balance cannot be negative");
  }

  return await db.transaction(async (tx) => {
    // Get current balance
    const currentUser = await tx
      .select({ balance: user.tokenBalance })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (currentUser.length === 0) {
      throw new Error("User not found");
    }

    const previousBalance = currentUser[0].balance;

    // Update balance
    await tx
      .update(user)
      .set({
        tokenBalance: newBalance,
        lastBalanceResetAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId));

    // Record transaction
    const [transaction] = await tx
      .insert(tokenBalanceTransaction)
      .values({
        userId,
        type: "reset",
        amount: newBalance, // For reset, amount is the new balance
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
 * Add tokens to user's existing balance (for top-ups, promos, adjustments)
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

  return await db.transaction(async (tx) => {
    // Get current balance
    const currentUser = await tx
      .select({ balance: user.tokenBalance })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (currentUser.length === 0) {
      throw new Error("User not found");
    }

    const previousBalance = currentUser[0].balance;
    const newBalance = previousBalance + amount;

    // Update balance
    await tx
      .update(user)
      .set({
        tokenBalance: newBalance,
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId));

    // Record transaction
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
 * Get balance transaction history for a user
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

/**
 * Custom error class for insufficient balance scenarios
 */
export class InsufficientBalanceError extends Error {
  public readonly currentBalance: number;
  public readonly requestedAmount: number;

  constructor(currentBalance: number, requestedAmount: number) {
    super(
      `Insufficient token balance. Current: ${currentBalance}, Requested: ${requestedAmount}`
    );
    this.name = "InsufficientBalanceError";
    this.currentBalance = currentBalance;
    this.requestedAmount = requestedAmount;
  }
}

/**
 * Format token balance for display
 */
export function formatTokenBalance(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1000) {
    return `${Math.round(tokens / 1000)}K`;
  }
  return tokens.toLocaleString();
}
