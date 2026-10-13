import { and, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db/connection";
import { balance, type PaymentIntent, transaction } from "@/lib/db/schema";

import { type BalancePool, ensureBalance } from "./balance";

/** `Transaction.referenceType` for refund rows; `referenceId` is the CP refund id. */
export const REFUND_REFERENCE_TYPE = "cloudpayments_refund";

export type RefundDebitPlan = {
  /** Minor units to take off the pool (never more than the pool holds). */
  debitAmount: number;
  /** Refunds of this payment so far, this one included, cover the whole charge. */
  isFullyRefunded: boolean;
};

export type ApplyRefundResult =
  | { status: "duplicate"; isFullyRefunded: boolean }
  | { status: "currency_mismatch"; balanceCurrencyCode: string }
  | {
      status: "applied";
      pool: BalancePool;
      debitAmount: number;
      isFullyRefunded: boolean;
      subscriptionBalanceAfter: number;
      topupBalanceAfter: number;
      transactionId: string;
    };

/**
 * Decide how much of a refund comes back off the balance. The debit floors at
 * zero: money the user already spent is the merchant's loss, and the other
 * pool (separately paid money) is never touched.
 */
export function planRefundDebit({
  refundAmount,
  poolBalance,
  paymentAmount,
  previouslyRefundedAmount,
}: {
  refundAmount: number;
  poolBalance: number;
  paymentAmount: number;
  previouslyRefundedAmount: number;
}): RefundDebitPlan {
  return {
    debitAmount: Math.max(0, Math.min(refundAmount, poolBalance)),
    isFullyRefunded: previouslyRefundedAmount + refundAmount >= paymentAmount,
  };
}

/** The balance pool a payment was credited to. */
export function poolForPayment(kind: PaymentIntent["kind"]): BalancePool {
  return kind === "topup" ? "topup" : "subscription";
}

/**
 * Take a CloudPayments refund back off the user's balance and record a
 * `refund` transaction, atomically.
 *
 * Idempotent per refund transaction: the balance row is locked first, so
 * concurrent or retried deliveries serialize and the second one finds the
 * existing `refund` row and returns `duplicate`.
 */
export async function applyPaymentRefund({
  intent,
  paymentTransactionId,
  refundTransactionId,
  refundAmount,
}: {
  intent: PaymentIntent;
  paymentTransactionId: string;
  refundTransactionId: string;
  refundAmount: number;
}): Promise<ApplyRefundResult> {
  if (refundAmount <= 0) {
    throw new Error("Refund amount must be positive");
  }

  await ensureBalance(intent.userId, intent.currencyCode);

  return await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(balance)
      .where(eq(balance.userId, intent.userId))
      .for("update")
      .limit(1);

    if (!row) {
      throw new Error(`Balance not found for user ${intent.userId}`);
    }

    // Sum of every refund already recorded against this payment (partial
    // refunds can add up to a full one).
    const [refunded] = await tx
      .select({
        total: sql<string>`coalesce(sum((${transaction.metadata}->>'refundedAmount')::bigint), 0)`,
        hasThisRefund: sql<boolean>`coalesce(bool_or(${transaction.referenceId} = ${refundTransactionId}), false)`,
      })
      .from(transaction)
      .where(
        and(
          eq(transaction.userId, intent.userId),
          eq(transaction.type, "refund"),
          eq(transaction.referenceType, REFUND_REFERENCE_TYPE),
          sql`${transaction.metadata}->>'refundOf' = ${paymentTransactionId}`
        )
      );

    const refundedSoFar = Number(refunded?.total ?? 0);

    if (refunded?.hasThisRefund) {
      return {
        status: "duplicate",
        isFullyRefunded: refundedSoFar >= intent.amount,
      };
    }

    if (row.currencyCode !== intent.currencyCode) {
      return {
        status: "currency_mismatch",
        balanceCurrencyCode: row.currencyCode,
      };
    }

    const pool = poolForPayment(intent.kind);
    const { debitAmount, isFullyRefunded } = planRefundDebit({
      refundAmount,
      poolBalance: pool === "topup" ? row.topupAmount : row.subscriptionAmount,
      paymentAmount: intent.amount,
      previouslyRefundedAmount: refundedSoFar,
    });

    const subscriptionBalanceAfter =
      pool === "subscription"
        ? row.subscriptionAmount - debitAmount
        : row.subscriptionAmount;
    const topupBalanceAfter =
      pool === "topup" ? row.topupAmount - debitAmount : row.topupAmount;

    await tx
      .update(balance)
      .set({
        subscriptionAmount: subscriptionBalanceAfter,
        topupAmount: topupBalanceAfter,
        updatedAt: new Date(),
      })
      .where(eq(balance.userId, intent.userId));

    // Recorded even when nothing could be debited: it is the audit trail and
    // the idempotency key for retries.
    const [refundRow] = await tx
      .insert(transaction)
      .values({
        userId: intent.userId,
        type: "refund",
        currencyCode: row.currencyCode,
        pool,
        amount: -debitAmount,
        subscriptionBalanceAfter,
        topupBalanceAfter,
        referenceType: REFUND_REFERENCE_TYPE,
        referenceId: refundTransactionId,
        description: "CloudPayments refund",
        metadata: {
          refundOf: paymentTransactionId,
          paymentIntentId: intent.id,
          refundedAmount: refundAmount,
        },
      })
      .returning({ id: transaction.id });

    return {
      status: "applied",
      pool,
      debitAmount,
      isFullyRefunded,
      subscriptionBalanceAfter,
      topupBalanceAfter,
      transactionId: refundRow.id,
    };
  });
}
