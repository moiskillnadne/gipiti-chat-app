import {
  type BalanceSummary,
  getBalance,
} from "@/server/modules/billing/balance";
import {
  getSpendProgress,
  type SpendProgress,
} from "@/server/modules/billing/spend";

export type BillingBalance = {
  /** Null until the account has a balance row. */
  balance: BalanceSummary | null;
  /** Null exactly when `balance` is. */
  spend: SpendProgress | null;
};

/** The balance with both pools and the spend progress of the current epoch. */
export const getBillingBalance = async (
  userId: string
): Promise<BillingBalance> => {
  const balance = await getBalance(userId);
  if (!balance) {
    return { balance: null, spend: null };
  }

  return { balance, spend: await getSpendProgress(userId, balance) };
};
