import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db/connection";
import {
  balance,
  type PaymentIntent,
  paymentIntent,
  transaction,
} from "@/lib/db/schema";
import {
  DEFAULT_CURRENCY_CODE,
  EMAIL_CONFIRM_BONUS_MAJOR_UNITS,
  USAGE_MARKUP,
} from "./constants";
import { getMinorUnits } from "./currencies";
import { getLatestFxRate } from "./fx";
import { majorToMinorUnits, usdToMinorUnits } from "./money";

export type BalanceSummary = {
  currencyCode: string;
  subscriptionAmount: number;
  topupAmount: number;
  total: number;
};

export type BalancePool = "subscription" | "topup";

type TransactionMetadata = {
  subscriptionCode?: string;
  subscriptionId?: string;
  paymentIntentId?: string;
  refundOf?: string;
  previousSubscriptionAmount?: number;
  previousTopupAmount?: number;
};

type BalanceChangeResult = {
  amount: number;
  subscriptionBalanceAfter: number;
  topupBalanceAfter: number;
  transactionId: string;
};

/**
 * Read a user's balance summary (both pools + total), or null if no row.
 */
export async function getBalance(
  userId: string
): Promise<BalanceSummary | null> {
  const [row] = await db
    .select()
    .from(balance)
    .where(eq(balance.userId, userId))
    .limit(1);

  if (!row) {
    return null;
  }

  return {
    currencyCode: row.currencyCode,
    subscriptionAmount: row.subscriptionAmount,
    topupAmount: row.topupAmount,
    total: row.subscriptionAmount + row.topupAmount,
  };
}

/**
 * Ensure a balance row exists for the user, creating a zeroed one in the given
 * currency when missing. Idempotent under concurrent callers.
 */
export async function ensureBalance(
  userId: string,
  currencyCode: string = DEFAULT_CURRENCY_CODE
): Promise<BalanceSummary> {
  const existing = await getBalance(userId);
  if (existing) {
    return existing;
  }

  await db
    .insert(balance)
    .values({ userId, currencyCode })
    .onConflictDoNothing({ target: balance.userId });

  const row = await getBalance(userId);
  if (!row) {
    throw new Error(`Failed to ensure balance row for user ${userId}`);
  }
  return row;
}

/**
 * Pre-inference gate: does the user have any spendable balance? Exact cost is
 * unknown until after inference, so we only require a positive total here.
 */
export async function hasPositiveBalance(userId: string): Promise<boolean> {
  const summary = await getBalance(userId);
  return summary ? summary.total > 0 : false;
}

/**
 * Charge a provider USD cost to the user's balance, converting via the latest
 * cached FX rate and the configured markup. Drains the subscription pool first,
 * then top-up, flooring at zero (never negative). Records one `usage_debit`
 * transaction snapshotting the pricing inputs. Returns null when there is
 * nothing to charge or no balance/FX rate is available.
 */
export async function chargeUsage({
  userId,
  usdCost,
  modelId,
  chatId,
  messageId,
  description,
}: {
  userId: string;
  usdCost: number;
  modelId?: string;
  chatId?: string;
  messageId?: string;
  description?: string;
}): Promise<BalanceChangeResult | null> {
  if (usdCost <= 0) {
    return null;
  }

  return await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(balance)
      .where(eq(balance.userId, userId))
      .for("update")
      .limit(1);

    if (!row) {
      return null;
    }

    const minorUnits = await getMinorUnits(row.currencyCode);
    const rate = await getLatestFxRate(row.currencyCode);
    if (rate == null) {
      // No FX rate cached yet — cannot price this request. Fail open (don't
      // charge) rather than block the user; the FX cron should populate rates.
      return null;
    }

    const amount = usdToMinorUnits({
      usdCost,
      fxRate: rate,
      minorUnits,
      markup: USAGE_MARKUP,
    });
    if (amount <= 0) {
      return null;
    }

    const fromSubscription = Math.min(amount, row.subscriptionAmount);
    const fromTopup = Math.min(amount - fromSubscription, row.topupAmount);
    const totalCharged = fromSubscription + fromTopup;
    const newSubscription = row.subscriptionAmount - fromSubscription;
    const newTopup = row.topupAmount - fromTopup;

    await tx
      .update(balance)
      .set({
        subscriptionAmount: newSubscription,
        topupAmount: newTopup,
        updatedAt: new Date(),
      })
      .where(eq(balance.userId, userId));

    const [debit] = await tx
      .insert(transaction)
      .values({
        userId,
        type: "usage_debit",
        currencyCode: row.currencyCode,
        // Attribute to the pool that bore the charge; subscription drains first.
        pool: fromSubscription > 0 ? "subscription" : "topup",
        amount: -totalCharged,
        subscriptionBalanceAfter: newSubscription,
        topupBalanceAfter: newTopup,
        usdCost: usdCost.toString(),
        fxRate: rate.toString(),
        markup: USAGE_MARKUP.toString(),
        modelId,
        chatId,
        messageId,
        description,
      })
      .returning({ id: transaction.id });

    return {
      amount: totalCharged,
      subscriptionBalanceAfter: newSubscription,
      topupBalanceAfter: newTopup,
      transactionId: debit.id,
    };
  });
}

/**
 * Credit a positive amount (minor units) to one balance pool. Used for the
 * welcome grant, top-up purchases, refunds, and admin adjustments.
 */
export async function creditBalance({
  userId,
  pool,
  amount,
  type,
  referenceType,
  referenceId,
  description,
  metadata,
}: {
  userId: string;
  pool: BalancePool;
  amount: number;
  type: "welcome" | "email_bonus" | "topup_purchase" | "refund" | "adjustment";
  referenceType?: string;
  referenceId?: string;
  description?: string;
  metadata?: TransactionMetadata;
}): Promise<BalanceChangeResult> {
  if (amount <= 0) {
    throw new Error("Credit amount must be positive");
  }

  await ensureBalance(userId);

  return await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(balance)
      .where(eq(balance.userId, userId))
      .for("update")
      .limit(1);

    if (!row) {
      throw new Error(`Balance not found for user ${userId}`);
    }

    const newSubscription =
      pool === "subscription"
        ? row.subscriptionAmount + amount
        : row.subscriptionAmount;
    const newTopup =
      pool === "topup" ? row.topupAmount + amount : row.topupAmount;

    await tx
      .update(balance)
      .set({
        subscriptionAmount: newSubscription,
        topupAmount: newTopup,
        updatedAt: new Date(),
      })
      .where(eq(balance.userId, userId));

    const [credit] = await tx
      .insert(transaction)
      .values({
        userId,
        type,
        currencyCode: row.currencyCode,
        pool,
        amount,
        subscriptionBalanceAfter: newSubscription,
        topupBalanceAfter: newTopup,
        referenceType,
        referenceId,
        description,
        metadata,
      })
      .returning({ id: transaction.id });

    return {
      amount,
      subscriptionBalanceAfter: newSubscription,
      topupBalanceAfter: newTopup,
      transactionId: credit.id,
    };
  });
}

/**
 * Credit a paid top-up to the persistent top-up pool, atomically with marking
 * its payment intent succeeded.
 *
 * Idempotent under webhook retries and concurrent deliveries: the intent is
 * claimed with a conditional UPDATE (`status <> 'succeeded'`) inside the same
 * transaction as the balance credit. A retry either blocks on the row lock
 * until the first delivery commits and then matches zero rows, or sees the
 * already-succeeded status — both return null without crediting twice.
 */
export async function creditTopupForIntent({
  intent,
  externalTransactionId,
}: {
  intent: PaymentIntent;
  externalTransactionId: string | null;
}): Promise<BalanceChangeResult | null> {
  if (intent.amount <= 0) {
    throw new Error("Top-up amount must be positive");
  }

  await ensureBalance(intent.userId, intent.currencyCode);

  return await db.transaction(async (tx) => {
    const claimed = await tx
      .update(paymentIntent)
      .set({
        status: "succeeded",
        externalTransactionId:
          externalTransactionId ?? intent.externalTransactionId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(paymentIntent.id, intent.id),
          ne(paymentIntent.status, "succeeded")
        )
      )
      .returning({ id: paymentIntent.id });

    // Another delivery already claimed this intent — nothing more to do.
    if (claimed.length === 0) {
      return null;
    }

    const [row] = await tx
      .select()
      .from(balance)
      .where(eq(balance.userId, intent.userId))
      .for("update")
      .limit(1);

    if (!row) {
      throw new Error(`Balance not found for user ${intent.userId}`);
    }

    const newTopup = row.topupAmount + intent.amount;

    await tx
      .update(balance)
      .set({ topupAmount: newTopup, updatedAt: new Date() })
      .where(eq(balance.userId, intent.userId));

    const [credit] = await tx
      .insert(transaction)
      .values({
        userId: intent.userId,
        type: "topup_purchase",
        currencyCode: row.currencyCode,
        pool: "topup",
        amount: intent.amount,
        subscriptionBalanceAfter: row.subscriptionAmount,
        topupBalanceAfter: newTopup,
        referenceType: "payment_intent",
        referenceId: intent.id,
        description: "One-time balance top-up",
        metadata: { paymentIntentId: intent.id },
      })
      .returning({ id: transaction.id });

    return {
      amount: intent.amount,
      subscriptionBalanceAfter: row.subscriptionAmount,
      topupBalanceAfter: newTopup,
      transactionId: credit.id,
    };
  });
}

/**
 * Credit the one-time email-verification bonus to the persistent top-up pool.
 *
 * Idempotent: if an `email_bonus` transaction already exists for the user this
 * is a no-op and returns null. The existence check and the credit run inside a
 * single row-locked transaction, so concurrent callers cannot double-credit.
 */
export async function grantEmailVerificationBonus(
  userId: string
): Promise<BalanceChangeResult | null> {
  await ensureBalance(userId);

  const summary = await getBalance(userId);
  const currencyCode = summary?.currencyCode ?? DEFAULT_CURRENCY_CODE;
  const minorUnits = await getMinorUnits(currencyCode);
  const amount = majorToMinorUnits(EMAIL_CONFIRM_BONUS_MAJOR_UNITS, minorUnits);

  return await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(balance)
      .where(eq(balance.userId, userId))
      .for("update")
      .limit(1);

    if (!row) {
      throw new Error(`Balance not found for user ${userId}`);
    }

    const [existing] = await tx
      .select({ id: transaction.id })
      .from(transaction)
      .where(
        and(eq(transaction.userId, userId), eq(transaction.type, "email_bonus"))
      )
      .limit(1);

    // Already granted — preserve idempotency under retries/concurrent calls.
    if (existing) {
      return null;
    }

    const newTopup = row.topupAmount + amount;

    await tx
      .update(balance)
      .set({ topupAmount: newTopup, updatedAt: new Date() })
      .where(eq(balance.userId, userId));

    const [credit] = await tx
      .insert(transaction)
      .values({
        userId,
        type: "email_bonus",
        currencyCode: row.currencyCode,
        pool: "topup",
        amount,
        subscriptionBalanceAfter: row.subscriptionAmount,
        topupBalanceAfter: newTopup,
        referenceType: "email_verification",
        description: "Email verification bonus",
      })
      .returning({ id: transaction.id });

    return {
      amount,
      subscriptionBalanceAfter: row.subscriptionAmount,
      topupBalanceAfter: newTopup,
      transactionId: credit.id,
    };
  });
}

/**
 * Credit a one-time reward for completing a quiz to the persistent top-up pool.
 *
 * Generic across quizzes: `quizKey` is stored as the transaction `referenceId`,
 * so each distinct quiz can grant exactly once. Idempotent — if a `quiz_bonus`
 * transaction already exists for this user and `quizKey` this is a no-op and
 * returns null. The existence check and the credit run inside a single
 * row-locked transaction, so concurrent callers cannot double-credit.
 */
export async function grantQuizBonus(
  userId: string,
  quizKey: string,
  bonusMajorUnits: number
): Promise<BalanceChangeResult | null> {
  await ensureBalance(userId);

  const summary = await getBalance(userId);
  const currencyCode = summary?.currencyCode ?? DEFAULT_CURRENCY_CODE;
  const minorUnits = await getMinorUnits(currencyCode);
  const amount = majorToMinorUnits(bonusMajorUnits, minorUnits);

  return await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(balance)
      .where(eq(balance.userId, userId))
      .for("update")
      .limit(1);

    if (!row) {
      throw new Error(`Balance not found for user ${userId}`);
    }

    const [existing] = await tx
      .select({ id: transaction.id })
      .from(transaction)
      .where(
        and(
          eq(transaction.userId, userId),
          eq(transaction.type, "quiz_bonus"),
          eq(transaction.referenceId, quizKey)
        )
      )
      .limit(1);

    // Already granted — preserve idempotency under retries/concurrent calls.
    if (existing) {
      return null;
    }

    const newTopup = row.topupAmount + amount;

    await tx
      .update(balance)
      .set({ topupAmount: newTopup, updatedAt: new Date() })
      .where(eq(balance.userId, userId));

    const [credit] = await tx
      .insert(transaction)
      .values({
        userId,
        type: "quiz_bonus",
        currencyCode: row.currencyCode,
        pool: "topup",
        amount,
        subscriptionBalanceAfter: row.subscriptionAmount,
        topupBalanceAfter: newTopup,
        referenceType: "onboarding_quiz",
        referenceId: quizKey,
        description: "Onboarding quiz bonus",
      })
      .returning({ id: transaction.id });

    return {
      amount,
      subscriptionBalanceAfter: row.subscriptionAmount,
      topupBalanceAfter: newTopup,
      transactionId: credit.id,
    };
  });
}

/**
 * Set the subscription pool to a fixed amount (renewal/purchase). The unused
 * remainder of the previous period is discarded (resets), then re-credited to
 * the new amount. Top-up pool is untouched. Records a `subscription_renewal`
 * (or `subscription_purchase`) transaction.
 */
export async function resetSubscriptionPool({
  userId,
  amount,
  currencyCode,
  type = "subscription_renewal",
  referenceId,
  metadata,
}: {
  userId: string;
  amount: number;
  currencyCode?: string;
  type?: "subscription_renewal" | "subscription_purchase";
  referenceId?: string;
  metadata?: TransactionMetadata;
}): Promise<BalanceChangeResult> {
  if (amount < 0) {
    throw new Error("Subscription pool amount cannot be negative");
  }

  await ensureBalance(userId, currencyCode);

  return await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(balance)
      .where(eq(balance.userId, userId))
      .for("update")
      .limit(1);

    if (!row) {
      throw new Error(`Balance not found for user ${userId}`);
    }

    const delta = amount - row.subscriptionAmount;

    await tx
      .update(balance)
      .set({ subscriptionAmount: amount, updatedAt: new Date() })
      .where(eq(balance.userId, userId));

    const [txn] = await tx
      .insert(transaction)
      .values({
        userId,
        type,
        currencyCode: row.currencyCode,
        pool: "subscription",
        amount: delta,
        subscriptionBalanceAfter: amount,
        topupBalanceAfter: row.topupAmount,
        referenceType: "subscription",
        referenceId,
        metadata: {
          ...metadata,
          previousSubscriptionAmount: row.subscriptionAmount,
        },
      })
      .returning({ id: transaction.id });

    return {
      amount: delta,
      subscriptionBalanceAfter: amount,
      topupBalanceAfter: row.topupAmount,
      transactionId: txn.id,
    };
  });
}

/**
 * Paginated transaction history for a user (most recent first).
 */
export async function getTransactions({
  userId,
  limit = 50,
  offset = 0,
}: {
  userId: string;
  limit?: number;
  offset?: number;
}) {
  return await db
    .select()
    .from(transaction)
    .where(eq(transaction.userId, userId))
    .orderBy(desc(transaction.createdAt))
    .limit(limit)
    .offset(offset);
}
