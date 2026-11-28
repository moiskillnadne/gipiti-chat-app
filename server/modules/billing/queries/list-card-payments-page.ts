import { and, desc, eq, inArray, or, type SQL, sql } from "drizzle-orm";

import { type DatabaseExecutor, db } from "@/server/db/connection";
import { transaction } from "@/server/db/schema";
import {
  CARD_PAYMENT_TYPES,
  type CardPaymentType,
  chargedMinorOf,
} from "@/server/modules/billing/payment-history";
import {
  createdAtText,
  isBeforePosition,
  type KeysetPosition,
} from "@/server/modules/billing/queries/keyset-position";

export type CardPaymentPageRow = {
  id: string;
  type: CardPaymentType;
  currencyCode: string;
  /** What the card was charged, in minor units (see `chargedMinorOf`). */
  chargedMinor: number;
  createdAt: Date;
  createdAtText: string;
};

export type CardPaymentPage = {
  rows: CardPaymentPageRow[];
  hasMore: boolean;
};

/**
 * Rows a card was really charged for. `Transaction.type` alone is not enough:
 * `assignFreePlan` writes a `subscription_renewal` of 0 when a subscription
 * ends, and the `reset-quotas` cron writes a `subscription_renewal` at the plan
 * price for a tester, with no card. Only the CloudPayments handlers
 * (`pay`, `recurrent`) record the plan's code in `metadata.subscriptionCode`,
 * and only `creditTopupForIntent` writes `referenceType = 'payment_intent'`.
 * A charge of zero or less never counts.
 */
export const isRealCardCharge: SQL = sql`(
  ${or(
    and(
      inArray(transaction.type, [
        "subscription_purchase",
        "subscription_renewal",
      ]),
      sql`${transaction.metadata} ->> 'subscriptionCode' IS NOT NULL`,
      sql`${transaction.subscriptionBalanceAfter} > 0`
    ),
    and(
      eq(transaction.type, "topup_purchase"),
      eq(transaction.referenceType, "payment_intent"),
      sql`${transaction.amount} > 0`
    )
  )}
)`;

type PageArgs = { userId: string; limit: number; after: KeysetPosition | null };

/**
 * One page of a user's card charges, newest first, by keyset on
 * `(createdAt, id)`. The charge is derived in `chargedMinorOf`, the same
 * function `getCardPayments` uses, from `amount` and
 * `subscriptionBalanceAfter`. The index `(user_id, created_at)` serves the
 * scan; the type filter is applied to the rows it reads.
 */
export const buildCardPaymentPageQuery = (
  { userId, limit, after }: PageArgs,
  executor: DatabaseExecutor = db
) =>
  executor
    .select({
      id: transaction.id,
      type: transaction.type,
      currencyCode: transaction.currencyCode,
      amount: transaction.amount,
      subscriptionBalanceAfter: transaction.subscriptionBalanceAfter,
      createdAt: transaction.createdAt,
      createdAtText: createdAtText(transaction.createdAt),
    })
    .from(transaction)
    .where(
      and(
        eq(transaction.userId, userId),
        inArray(transaction.type, [...CARD_PAYMENT_TYPES]),
        isRealCardCharge,
        isBeforePosition(transaction.createdAt, transaction.id, after)
      )
    )
    .orderBy(desc(transaction.createdAt), desc(transaction.id))
    .limit(limit + 1);

export const listCardPaymentsPage = async (
  args: PageArgs,
  executor: DatabaseExecutor = db
): Promise<CardPaymentPage> => {
  const fetched = await buildCardPaymentPageQuery(args, executor);
  const hasMore = fetched.length > args.limit;

  const rows = (hasMore ? fetched.slice(0, args.limit) : fetched).map(
    (row) => ({
      id: row.id,
      type: row.type as CardPaymentType,
      currencyCode: row.currencyCode,
      chargedMinor: chargedMinorOf(row),
      createdAt: row.createdAt,
      createdAtText: row.createdAtText,
    })
  );

  return { rows, hasMore };
};
