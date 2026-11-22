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

export const BADGE_CLASS_BY_TYPE: Record<TransactionType, string> = {
  welcome: "bg-green-100 text-green-800",
  email_bonus: "bg-green-100 text-green-800",
  quiz_bonus: "bg-green-100 text-green-800",
  subscription_renewal: "bg-green-100 text-green-800",
  subscription_purchase: "bg-green-100 text-green-800",
  topup_purchase: "bg-green-100 text-green-800",
  usage_debit: "bg-red-100 text-red-800",
  refund: "bg-blue-100 text-blue-800",
  adjustment: "",
};

const CREDIT_AMOUNT_CLASS = "text-green-600";
const DEBIT_AMOUNT_CLASS = "text-red-600";

export const toHistoryRow = (transaction: Transaction): HistoryRow => {
  const isCredit = transaction.amount > 0;
  const sign = isCredit ? "+" : "-";
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
