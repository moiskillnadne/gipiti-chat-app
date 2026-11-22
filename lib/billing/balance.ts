import { and, desc, eq, ne } from "drizzle-orm";
import { type DatabaseExecutor, db } from "@/server/db/connection";
import {
  balance,
  type PaymentIntent,
  paymentIntent,
  transaction,
  user,
} from "@/server/db/schema";
import {
  DEFAULT_CURRENCY_CODE,
  EMAIL_CONFIRM_BONUS_MAJOR_UNITS,
  USAGE_MARKUP,
  WELCOME_GRANT_MAJOR_UNITS,
} from "./constants";
import { getMinorUnits } from "./currencies";
import { assertEmailVerified } from "./email-verification";
import { getCurrencyPricing } from "./fx";
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
  refundedAmount?: number;
  previousSubscriptionAmount?: number;
  previousTopupAmount?: number;
  /** Usage debit floored at zero: what the turn cost, in minor units. */
  requestedAmount?: number;
  /** Usage debit floored at zero: the part of `requestedAmount` not debited. */
  shortfallAmount?: number;
};

type BalanceChangeResult = {
  amount: number;
  subscriptionBalanceAfter: number;
  topupBalanceAfter: number;
  transactionId: string;
};

/**
 * Read a user's balance summary (both pools + total), or null if no row.
 * Inside a transaction, pass it as `executor`.
 */
export async function getBalance(
  userId: string,
  executor: DatabaseExecutor = db
): Promise<BalanceSummary | null> {
  const [row] = await executor
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
 * currency when missing. Idempotent under concurrent callers. Inside a
 * transaction, pass it as `executor`: the row then exists only if that
 * transaction commits.
 */
export async function ensureBalance(
  userId: string,
  currencyCode: string = DEFAULT_CURRENCY_CODE,
  executor: DatabaseExecutor = db
): Promise<BalanceSummary> {
  const existing = await getBalance(userId, executor);
  if (existing) {
    return existing;
  }

  await executor
    .insert(balance)
    .values({ userId, currencyCode })
    .onConflictDoNothing({ target: balance.userId });

  const row = await getBalance(userId, executor);
  if (!row) {
    throw new Error(`Failed to ensure balance row for user ${userId}`);
  }
  return row;
}

/**
 * Charge a provider USD cost to the user's balance, converting via the latest
 * cached FX rate and the configured markup. Drains the subscription pool first,
 * then top-up, flooring at zero (never negative). Records one `usage_debit`
 * transaction snapshotting the pricing inputs; when the floor cut the charge,
 * the uncharged remainder goes into its metadata and a warning. Returns null
 * when there is nothing to charge or no balance/FX rate is available.
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

    // Priced on the transaction's own connection. Through the global `db`
    // this lookup would wait for a second pool connection while holding the
    // first, and a pool's worth of concurrent charges would never finish.
    const { minorUnits, fxRate: rate } = await getCurrencyPricing(
      row.currencyCode,
      tx
    );
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
    const shortfallAmount = amount - totalCharged;
    const shortfallMetadata: TransactionMetadata | undefined =
      shortfallAmount > 0
        ? { requestedAmount: amount, shortfallAmount }
        : undefined;

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
        metadata: shortfallMetadata,
      })
      .returning({ id: transaction.id });

    if (shortfallMetadata) {
      console.warn("[billing] usage charge floored at zero", {
        userId,
        chatId,
        messageId,
        modelId,
        currencyCode: row.currencyCode,
        requestedAmount: amount,
        chargedAmount: totalCharged,
        shortfallAmount,
        transactionId: debit.id,
      });
    }

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
 *
 * Inside a transaction, pass it as `executor`: the balance row is ensured and
 * the credit is written on that transaction (as a savepoint), so the credit
 * commits or rolls back together with the caller's other writes.
 */
export async function creditBalance(
  {
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
    type:
      | "welcome"
      | "email_bonus"
      | "topup_purchase"
      | "refund"
      | "adjustment";
    referenceType?: string;
    referenceId?: string;
    description?: string;
    metadata?: TransactionMetadata;
  },
  executor: DatabaseExecutor = db
): Promise<BalanceChangeResult> {
  if (amount <= 0) {
    throw new Error("Credit amount must be positive");
  }

  await ensureBalance(userId, DEFAULT_CURRENCY_CODE, executor);

  return await executor.transaction(async (tx) => {
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
 * Credit the welcome grant that an API sign-up did not get at registration.
 *
 * A website sign-up is paid its welcome grant in the transaction that creates
 * the account. An account created through the API (`User.signup_platform` is
 * set) is paid here instead, once its email is verified.
 *
 * Returns null, and credits nothing, unless all of these hold, checked on the
 * locked balance row so that concurrent callers cannot double-credit:
 *
 * - the account has a sign-up platform (a website or older account either
 *   got the grant at registration or predates it, and must not get one now);
 * - its email is verified;
 * - it has no `welcome` transaction yet.
 */
export async function grantDeferredWelcomeBonus(
  userId: string
): Promise<BalanceChangeResult | null> {
  await ensureBalance(userId);

  const summary = await getBalance(userId);
  const currencyCode = summary?.currencyCode ?? DEFAULT_CURRENCY_CODE;
  const minorUnits = await getMinorUnits(currencyCode);
  const amount = majorToMinorUnits(WELCOME_GRANT_MAJOR_UNITS, minorUnits);

  return await db.transaction(async (tx) => {
    // The lock: a second caller waits here and then finds the transaction.
    const [row] = await tx
      .select({ userId: balance.userId })
      .from(balance)
      .where(eq(balance.userId, userId))
      .for("update")
      .limit(1);

    if (!row) {
      throw new Error(`Balance not found for user ${userId}`);
    }

    const [account] = await tx
      .select({
        signupPlatform: user.signupPlatform,
        emailVerified: user.emailVerified,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!(account?.signupPlatform && account.emailVerified)) {
      return null;
    }

    const [existing] = await tx
      .select({ id: transaction.id })
      .from(transaction)
      .where(
        and(eq(transaction.userId, userId), eq(transaction.type, "welcome"))
      )
      .limit(1);

    if (existing) {
      return null;
    }

    // The same transaction row a website sign-up gets, on this transaction.
    return await creditBalance(
      {
        userId,
        pool: "topup",
        amount,
        type: "welcome",
        description: "Welcome grant",
      },
      tx
    );
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
 *
 * Requires a confirmed email (read from the database): throws
 * `EmailNotVerifiedError` before any write when the email is not verified.
 */
export async function grantQuizBonus(
  userId: string,
  quizKey: string,
  bonusMajorUnits: number
): Promise<BalanceChangeResult | null> {
  await assertEmailVerified(userId);
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
