import "server-only";
import { count, desc, eq } from "drizzle-orm";
import { getBalance } from "@/lib/billing/balance";
import { chat, type Transaction, transaction } from "@/lib/db/schema";
import { db } from "../db/connection";

export type TransactionWithChat = {
  id: string;
  type: Transaction["type"];
  pool: Transaction["pool"];
  currencyCode: string;
  amount: number;
  subscriptionBalanceAfter: number;
  topupBalanceAfter: number;
  modelId: string | null;
  description: string | null;
  referenceType: string | null;
  createdAt: Date;
  chatTitle: string | null;
};

export type TransactionsResult = {
  transactions: TransactionWithChat[];
  total: number;
};

export type BalanceSummary = {
  balance: number;
  currencyCode: string;
};

/**
 * Get paginated balance transactions with chat titles, most recent first.
 */
export async function getTransactionsWithChats({
  userId,
  limit = 20,
  offset = 0,
}: {
  userId: string;
  limit?: number;
  offset?: number;
}): Promise<TransactionsResult> {
  const [countResult] = await db
    .select({ count: count() })
    .from(transaction)
    .where(eq(transaction.userId, userId));

  const rows = await db
    .select({
      id: transaction.id,
      type: transaction.type,
      pool: transaction.pool,
      currencyCode: transaction.currencyCode,
      amount: transaction.amount,
      subscriptionBalanceAfter: transaction.subscriptionBalanceAfter,
      topupBalanceAfter: transaction.topupBalanceAfter,
      modelId: transaction.modelId,
      description: transaction.description,
      referenceType: transaction.referenceType,
      createdAt: transaction.createdAt,
      chatTitle: chat.title,
    })
    .from(transaction)
    .leftJoin(chat, eq(transaction.chatId, chat.id))
    .where(eq(transaction.userId, userId))
    .orderBy(desc(transaction.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    transactions: rows,
    total: countResult?.count ?? 0,
  };
}

/**
 * Get the user's combined balance summary (total across both pools).
 * Returns null when the user has no balance row yet.
 */
export async function getUsageSummary(
  userId: string
): Promise<BalanceSummary | null> {
  const summary = await getBalance(userId);
  if (!summary) {
    return null;
  }

  return {
    balance: summary.total,
    currencyCode: summary.currencyCode,
  };
}
