import "server-only";
import { count, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/queries";
import { chat, tokenBalanceTransaction, user } from "@/lib/db/schema";
import { getUserBalance } from "@/lib/ai/token-balance";

interface TransactionWithChat {
  id: string;
  type: "credit" | "debit" | "reset" | "adjustment";
  amount: number;
  balanceAfter: number;
  description: string | null;
  referenceType: string | null;
  metadata: {
    modelId?: string;
    chatId?: string;
    planName?: string;
    subscriptionId?: string;
    previousBalance?: number;
  } | null;
  createdAt: Date;
  chatTitle: string | null;
}

interface TransactionsResult {
  transactions: TransactionWithChat[];
  total: number;
}

interface UsageSummary {
  quota: number;
  balance: number;
  spent: number;
  remaining: number;
}

/**
 * Get paginated balance transactions with chat titles
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
  // Get total count
  const [countResult] = await db
    .select({ count: count() })
    .from(tokenBalanceTransaction)
    .where(eq(tokenBalanceTransaction.userId, userId));

  // Get transactions with left join to chat for titles
  const transactions = await db
    .select({
      id: tokenBalanceTransaction.id,
      type: tokenBalanceTransaction.type,
      amount: tokenBalanceTransaction.amount,
      balanceAfter: tokenBalanceTransaction.balanceAfter,
      description: tokenBalanceTransaction.description,
      referenceType: tokenBalanceTransaction.referenceType,
      metadata: tokenBalanceTransaction.metadata,
      createdAt: tokenBalanceTransaction.createdAt,
      chatTitle: chat.title,
    })
    .from(tokenBalanceTransaction)
    .leftJoin(
      chat,
      sql`${tokenBalanceTransaction.metadata}->>'chatId' = ${chat.id}::text`
    )
    .where(eq(tokenBalanceTransaction.userId, userId))
    .orderBy(desc(tokenBalanceTransaction.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    transactions: transactions as TransactionWithChat[],
    total: countResult?.count ?? 0,
  };
}

/**
 * Get usage summary for current billing period
 */
export async function getUsageSummary(
  userId: string
): Promise<UsageSummary | null> {
  // Get user's token balance
  const [userData] = await db
    .select({
      tokenBalance: user.tokenBalance,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (!userData) {
    return null;
  }

  // Get quota from active subscription using existing function
  const balanceInfo = await getUserBalance(userId);

  if (!balanceInfo?.subscription) {
    return null;
  }

  const quota = balanceInfo.subscription.tokenQuota;
  const balance = Number(userData.tokenBalance) || 0;
  const spent = Math.max(0, quota - balance);

  return {
    quota,
    balance,
    spent,
    remaining: Math.max(0, balance),
  };
}
