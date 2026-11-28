import { DEFAULT_CURRENCY_CODE } from "@/lib/billing/constants";
import { getBalance } from "@/server/modules/billing/balance";
import {
  type ChatSpendRow,
  getChatSpendHistory,
  getRecentSpendMinor,
} from "@/server/modules/billing/spend";

/** The seven days the history footer sums over. */
const RECENT_SPEND_DAYS = 7;

export type SpendHistory = {
  /** The currency the amounts are in: the user's balance currency. */
  currencyCode: string;
  chats: ChatSpendRow[];
  recentSpendMinor: number;
};

/**
 * What the balance page's history card shows: the most recent chats by what
 * they cost, and the spend of the last seven days. A user without a balance
 * row has no debits, so the default currency only labels zeros.
 */
export const getSpendHistory = async ({
  userId,
  limit,
}: {
  userId: string;
  limit: number;
}): Promise<SpendHistory> => {
  const [balance, chats, recentSpendMinor] = await Promise.all([
    getBalance(userId),
    getChatSpendHistory(userId, limit),
    getRecentSpendMinor(userId, RECENT_SPEND_DAYS),
  ]);

  return {
    currencyCode: balance?.currencyCode ?? DEFAULT_CURRENCY_CODE,
    chats,
    recentSpendMinor,
  };
};
