import { format } from "date-fns";

import { formatCurrency } from "@/lib/billing/money";

export type TransactionType =
  | "welcome"
  | "email_bonus"
  | "quiz_bonus"
  | "subscription_renewal"
  | "subscription_purchase"
  | "topup_purchase"
  | "usage_debit"
  | "refund"
  | "adjustment";

export type Transaction = {
  id: string;
  type: TransactionType;
  pool: "subscription" | "topup";
  currencyCode: string;
  amount: number;
  createdAt: string;
  modelId: string | null;
  chatTitle: string | null;
  description: string | null;
};

/** One transaction prepared for display; both the phone list and the table render it. */
export type HistoryRow = {
  id: string;
  type: TransactionType;
  createdAt: string;
  dateLabel: string;
  title: string | null;
  modelId: string | null;
  amountLabel: string;
  amountClassName: string;
};

const CREDIT_BADGE_CLASS = "bg-success-soft text-success-ink";

/**
 * Red is kept for errors: spending on a request is a normal event and reads neutral, money
 * coming in reads as success, and a payment refund (money returned to the card, debited from
 * the balance) is informational. The amount's «+»/«-» sign carries direction without colour.
 */
export const BADGE_CLASS_BY_TYPE: Record<TransactionType, string> = {
  welcome: CREDIT_BADGE_CLASS,
  email_bonus: CREDIT_BADGE_CLASS,
  quiz_bonus: CREDIT_BADGE_CLASS,
  subscription_renewal: CREDIT_BADGE_CLASS,
  subscription_purchase: CREDIT_BADGE_CLASS,
  topup_purchase: CREDIT_BADGE_CLASS,
  usage_debit: "bg-paper-2 text-ink-2",
  refund: "bg-info-soft text-info-ink",
  adjustment: "",
};

const CREDIT_AMOUNT_CLASS = "text-success-ink";
const DEBIT_AMOUNT_CLASS = "text-ink";

export const toHistoryRow = (transaction: Transaction): HistoryRow => {
  const isCredit = transaction.amount > 0;
  const isDebit = transaction.amount < 0;
  // A zero amount moved no money, so it carries no sign and reads neutral
  const sign = isCredit ? "+" : isDebit ? "-" : "";
  const formattedAmount = formatCurrency(
    Math.abs(transaction.amount),
    transaction.currencyCode
  );

  return {
    id: transaction.id,
    type: transaction.type,
    createdAt: transaction.createdAt,
    dateLabel: format(new Date(transaction.createdAt), "MMM d, yyyy HH:mm"),
    title: transaction.chatTitle || transaction.description || null,
    modelId: transaction.modelId,
    amountLabel: `${sign}${formattedAmount}`,
    amountClassName: isCredit ? CREDIT_AMOUNT_CLASS : DEBIT_AMOUNT_CLASS,
  };
};
