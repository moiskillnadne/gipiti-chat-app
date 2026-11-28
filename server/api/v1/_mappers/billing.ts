import type {
  CardPaymentDto,
  ChatSpendDto,
  SubscriptionDto,
  TransactionDto,
} from "@/server/api/v1/_schemas/billing";
import type { Money } from "@/server/api/v1/_schemas/money";
import type { CardPaymentPageRow } from "@/server/modules/billing/queries/list-card-payments-page";
import type { TransactionPageRow } from "@/server/modules/billing/queries/list-transactions-page";
import type { ChatSpendRow } from "@/server/modules/billing/spend";
import type { SubscriptionSummary } from "@/server/modules/subscription/get-subscription-summary";

export const toMoney = (amountMinor: number, currencyCode: string): Money => ({
  amountMinor,
  currencyCode,
});

/** Leaves out the owner, the balances after the change and the raw metadata. */
export const toTransactionDto = (row: TransactionPageRow): TransactionDto => ({
  id: row.id,
  type: row.type,
  pool: row.pool,
  amount: toMoney(row.amount, row.currencyCode),
  modelId: row.modelId,
  chatTitle: row.chatTitle,
  description: row.description,
  createdAt: row.createdAt.toISOString(),
});

export const toChatSpendDto = (
  row: ChatSpendRow,
  currencyCode: string
): ChatSpendDto => ({
  chatId: row.chatId,
  title: row.title,
  model: row.model,
  messages: row.messages,
  searches: row.searches,
  images: row.images,
  videos: row.videos,
  total: toMoney(row.totalMinor, currencyCode),
  lastActivityAt: row.last.toISOString(),
});

export const toCardPaymentDto = (row: CardPaymentPageRow): CardPaymentDto => ({
  id: row.id,
  type: row.type,
  charged: toMoney(row.chargedMinor, row.currencyCode),
  createdAt: row.createdAt.toISOString(),
});

/** Leaves out the payment provider's ids and the card token. */
export const toSubscriptionDto = (
  summary: SubscriptionSummary
): SubscriptionDto => ({
  planCode: summary.planCode,
  displayName: summary.displayName,
  billingPeriod: summary.billingPeriod,
  status: summary.status,
  state: summary.state,
  currentPeriodStart: summary.currentPeriodStart.toISOString(),
  currentPeriodEnd: summary.currentPeriodEnd.toISOString(),
  cancelAtPeriodEnd: summary.cancelAtPeriodEnd,
  cancelledAt: summary.cancelledAt?.toISOString() ?? null,
  price:
    summary.priceMinor === null
      ? null
      : toMoney(summary.priceMinor, summary.currencyCode),
  nextPayment: summary.nextPayment
    ? {
        date: summary.nextPayment.date.toISOString(),
        amount:
          summary.nextPayment.amountMinor === null
            ? null
            : toMoney(summary.nextPayment.amountMinor, summary.currencyCode),
      }
    : null,
  cardMask: summary.cardMask,
});
