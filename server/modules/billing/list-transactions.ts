import type { KeysetPosition } from "@/server/modules/billing/queries/keyset-position";
import {
  countUserTransactions,
  listTransactionsPage,
  type TransactionPageRow,
} from "@/server/modules/billing/queries/list-transactions-page";

export type ListTransactionsResult = {
  transactions: TransactionPageRow[];
  /** A next page exists; it starts after the last of `transactions`. */
  hasMore: boolean;
  /** All the user's transactions, whatever the page. */
  totalCount: number;
};

/**
 * One page of the user's balance transactions, newest first, with the total
 * the history pager shows. `after` is only a position, never a row to look
 * up, so it can reveal nothing about anyone's transactions.
 */
export const listTransactions = async ({
  userId,
  limit,
  after,
}: {
  userId: string;
  limit: number;
  after: KeysetPosition | null;
}): Promise<ListTransactionsResult> => {
  const [page, totalCount] = await Promise.all([
    listTransactionsPage({ userId, limit, after }),
    countUserTransactions(userId),
  ]);

  return {
    transactions: page.rows,
    hasMore: page.hasMore,
    totalCount,
  };
};
