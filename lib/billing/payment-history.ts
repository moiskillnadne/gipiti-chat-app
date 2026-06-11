import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/connection";
import { transaction } from "@/lib/db/schema";

/** Transaction types that correspond to real charges from the user's card. */
const CARD_PAYMENT_TYPES = [
  "subscription_purchase",
  "subscription_renewal",
  "topup_purchase",
] as const;

export type CardPaymentType = (typeof CARD_PAYMENT_TYPES)[number];

export type CardPayment = {
  id: string;
  type: CardPaymentType;
  /** Actual card charge in minor units of the user's currency. */
  chargedMinor: number;
  createdAt: Date;
};

/**
 * Recent card charges (subscription purchases/renewals and top-ups) for the
 * payment-history block on the manage-subscription page.
 *
 * For subscription rows `Transaction.amount` is the pool-reset delta
 * (`price − previousSubscriptionAmount`), not the card charge. The charge
 * equals `subscriptionBalanceAfter` because the pool is reset exactly to the
 * plan price. Top-up rows credit the pool 1:1, so `amount` is the charge.
 */
export async function getCardPayments({
  userId,
  limit = 10,
}: {
  userId: string;
  limit?: number;
}): Promise<CardPayment[]> {
  const rows = await db
    .select({
      id: transaction.id,
      type: transaction.type,
      amount: transaction.amount,
      subscriptionBalanceAfter: transaction.subscriptionBalanceAfter,
      createdAt: transaction.createdAt,
    })
    .from(transaction)
    .where(
      and(
        eq(transaction.userId, userId),
        inArray(transaction.type, [...CARD_PAYMENT_TYPES])
      )
    )
    .orderBy(desc(transaction.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    type: row.type as CardPaymentType,
    chargedMinor:
      row.type === "topup_purchase" ? row.amount : row.subscriptionBalanceAfter,
    createdAt: row.createdAt,
  }));
}
