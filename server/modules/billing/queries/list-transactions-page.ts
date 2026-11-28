import { and, count, desc, eq } from "drizzle-orm";

import { type DatabaseExecutor, db } from "@/server/db/connection";
import { chat, type Transaction, transaction } from "@/server/db/schema";
import {
  createdAtText,
  isBeforePosition,
  type KeysetPosition,
} from "@/server/modules/billing/queries/keyset-position";

export type TransactionPageRow = {
  id: string;
  type: Transaction["type"];
  pool: Transaction["pool"];
  currencyCode: string;
  /** Signed minor units: a debit is negative. */
  amount: number;
  modelId: string | null;
  description: string | null;
  chatTitle: string | null;
  createdAt: Date;
  /** The database's own text for `createdAt` (microseconds), for the cursor. */
  createdAtText: string;
};

export type TransactionPage = { rows: TransactionPageRow[]; hasMore: boolean };

type PageArgs = { userId: string; limit: number; after: KeysetPosition | null };

/**
 * One page of a user's transactions, newest first, by keyset on
 * `(createdAt, id)`. Served by `transaction_user_created_idx (user_id,
 * created_at)`; the id only breaks exact ties. The chat title comes from a
 * left join on the chat's primary key. Fetches one row more than `limit`.
 *
 * Exported before it runs so a test can ask the planner about it.
 */
export const buildTransactionPageQuery = (
  { userId, limit, after }: PageArgs,
  executor: DatabaseExecutor = db
) =>
  executor
    .select({
      id: transaction.id,
      type: transaction.type,
      pool: transaction.pool,
      currencyCode: transaction.currencyCode,
      amount: transaction.amount,
      modelId: transaction.modelId,
      description: transaction.description,
      chatTitle: chat.title,
      createdAt: transaction.createdAt,
      createdAtText: createdAtText(transaction.createdAt),
    })
    .from(transaction)
    .leftJoin(chat, eq(transaction.chatId, chat.id))
    .where(
      and(
        eq(transaction.userId, userId),
        isBeforePosition(transaction.createdAt, transaction.id, after)
      )
    )
    .orderBy(desc(transaction.createdAt), desc(transaction.id))
    .limit(limit + 1);

export const listTransactionsPage = async (
  args: PageArgs,
  executor: DatabaseExecutor = db
): Promise<TransactionPage> => {
  const rows = await buildTransactionPageQuery(args, executor);
  const hasMore = rows.length > args.limit;

  return { rows: hasMore ? rows.slice(0, args.limit) : rows, hasMore };
};

/**
 * The count query before it runs; exported so a test can ask the planner about
 * it. `count(*)` over `user_id = ?` is answered by an index-only scan.
 */
export const buildCountUserTransactionsQuery = (
  userId: string,
  executor: DatabaseExecutor = db
) =>
  executor
    .select({ total: count() })
    .from(transaction)
    .where(eq(transaction.userId, userId));

/** How many transactions the user has, whatever the page. */
export const countUserTransactions = async (
  userId: string,
  executor: DatabaseExecutor = db
): Promise<number> => {
  const [row] = await buildCountUserTransactionsQuery(userId, executor);

  return row?.total ?? 0;
};
