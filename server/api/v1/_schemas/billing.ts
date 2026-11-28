import { z } from "zod/v4";

import { openEnum } from "@/server/api/_kit/open-enum";
import {
  limitQuerySchema,
  pageOutputSchema,
  pageQuerySchema,
} from "@/server/api/_kit/pagination";
import { balanceSchema } from "@/server/api/v1/_schemas/me";
import { moneySchema } from "@/server/api/v1/_schemas/money";
import { KNOWN_BILLING_PERIODS } from "@/server/api/v1/_schemas/plan";

export const KNOWN_TRANSACTION_TYPES = [
  "welcome",
  "email_bonus",
  "quiz_bonus",
  "subscription_renewal",
  "subscription_purchase",
  "topup_purchase",
  "usage_debit",
  "refund",
  "adjustment",
] as const;

export const KNOWN_BALANCE_POOLS = ["subscription", "topup"] as const;

export const KNOWN_CARD_PAYMENT_TYPES = [
  "subscription_purchase",
  "subscription_renewal",
  "topup_purchase",
] as const;

export const KNOWN_SUBSCRIPTION_STATUSES = [
  "active",
  "past_due",
  "cancelled",
  "expired",
] as const;

export const KNOWN_SUBSCRIPTION_STATES = [
  "active",
  "cancelled",
  "past_due",
  "none",
] as const;

/** `data.reason` of a 400 from the two cursor lists of `/me/billing`. */
export const KNOWN_BILLING_LIST_BAD_REQUEST_REASONS = [
  "invalid_cursor",
] as const;

export const billingListBadRequestDataSchema = z.object({
  reason: openEnum(KNOWN_BILLING_LIST_BAD_REQUEST_REASONS),
});

const isoDate = z.string().meta({ description: "ISO 8601, UTC." });

export const billingBalanceSchema = z.object({
  balance: balanceSchema
    .nullable()
    .meta({ description: "Null until the account has a balance row." }),
  spend: z
    .object({
      spentPercent: z.number().int().min(0).max(100).meta({
        description:
          "Share of the balance granted by the last credit that is already spent, rounded.",
      }),
      epochKey: z.string().meta({
        description:
          "Identifies the balance period since the last credit. It changes when a new credit lands, which is when spend warnings start over.",
      }),
    })
    .nullable()
    .meta({ description: "Null exactly when `balance` is." }),
});

export const transactionSchema = z.object({
  id: z.uuid(),
  type: openEnum(KNOWN_TRANSACTION_TYPES),
  pool: openEnum(KNOWN_BALANCE_POOLS).meta({
    description: "The balance pool the transaction changed.",
  }),
  amount: moneySchema.meta({
    description: "Signed: a debit is negative, a credit is positive.",
  }),
  modelId: z.string().nullable().meta({
    description:
      "The model of a usage debit. Usually an id from `GET /models`; a web search or page extraction debit carries `tavily-search` or `tavily-extract`.",
  }),
  chatTitle: z.string().nullable().meta({
    description: "The title of the chat a usage debit belongs to, if any.",
  }),
  description: z.string().nullable(),
  createdAt: isoDate,
});

export type TransactionDto = z.infer<typeof transactionSchema>;

export const transactionListInputSchema = pageQuerySchema;

export const transactionListSchema = pageOutputSchema(transactionSchema).extend(
  {
    totalCount: z.number().int().min(0).meta({
      description: "All the caller's transactions, not only this page.",
    }),
  }
);

const SPEND_HISTORY_DEFAULT_LIMIT = 6;

export const spendHistoryInputSchema = z.object({
  limit: limitQuerySchema(SPEND_HISTORY_DEFAULT_LIMIT),
});

export const chatSpendSchema = z.object({
  chatId: z.uuid(),
  title: z.string(),
  model: z.string().nullable().meta({
    description:
      "Display name of the chat model used most recently in the chat.",
  }),
  messages: z.number().int().min(0),
  searches: z.number().int().min(0),
  images: z.number().int().min(0),
  videos: z.number().int().min(0),
  total: moneySchema,
  lastActivityAt: isoDate,
});

export type ChatSpendDto = z.infer<typeof chatSpendSchema>;

export const spendHistorySchema = z.object({
  items: z.array(chatSpendSchema).meta({
    description:
      "The chats with the most recent spend, newest first, from the latest 500 usage debits.",
  }),
  recentSpend: moneySchema.meta({
    description: "Total spent on usage over the last seven days.",
  }),
});

export const cardPaymentSchema = z.object({
  id: z.uuid(),
  type: openEnum(KNOWN_CARD_PAYMENT_TYPES),
  charged: moneySchema.meta({
    description:
      "What the card was charged. A later refund does not change it.",
  }),
  createdAt: isoDate,
});

export type CardPaymentDto = z.infer<typeof cardPaymentSchema>;

export const cardPaymentListInputSchema = pageQuerySchema;

export const cardPaymentListSchema = pageOutputSchema(cardPaymentSchema);

export const subscriptionSchema = z.object({
  planCode: z.string().meta({ description: "For example `basic_monthly`." }),
  displayName: z.string().nullable(),
  billingPeriod: openEnum(KNOWN_BILLING_PERIODS),
  status: openEnum(KNOWN_SUBSCRIPTION_STATUSES).meta({
    description: "The stored status of the subscription.",
  }),
  state: openEnum(KNOWN_SUBSCRIPTION_STATES).meta({
    description:
      "What the status and the dates mean for the user, as the website decides it: `active`; `cancelled` (will not renew, access until `currentPeriodEnd`); `past_due` (the last charge failed); `none` (the subscription has ended or expired, the user is on the free tier). Clients show this and do not derive it again. Use `state`, not `hasActiveSubscription` of `GET /me`, for what to render and for the top-up gate: `state` ignores a period end that has passed unless the subscription is cancelled, so until the renewal webhook or cron runs the two can differ.",
  }),
  currentPeriodStart: isoDate,
  currentPeriodEnd: isoDate,
  cancelAtPeriodEnd: z.boolean(),
  cancelledAt: isoDate.nullable(),
  price: moneySchema.nullable().meta({
    description:
      "The plan price per billing period in the account's currency; null when the plan has no active price in it.",
  }),
  nextPayment: z
    .object({
      date: isoDate,
      amount: moneySchema.nullable(),
    })
    .nullable()
    .meta({
      description:
        "The next charge. For `past_due` it is the next retry and `amount` is null. Null when `state` is `cancelled` or `none`.",
    }),
  cardMask: z.string().nullable().meta({
    description:
      "The masked card number of the payment method, if one is stored.",
  }),
});

export type SubscriptionDto = z.infer<typeof subscriptionSchema>;

export const meSubscriptionSchema = z.object({
  subscription: subscriptionSchema.nullable().meta({
    description: "Null when the account never had a subscription.",
  }),
});
