import { oc } from "@orpc/contract";

import { callerAccess } from "@/server/api/_kit/caller-access";
import { unauthorizedError } from "@/server/api/_kit/common-errors";
import {
  billingBalanceSchema,
  cardPaymentListInputSchema,
  cardPaymentListSchema,
  spendHistoryInputSchema,
  spendHistorySchema,
  transactionListInputSchema,
  transactionListSchema,
} from "@/server/api/v1/_schemas/billing";
import { billingListBadRequestWithReason } from "@/server/api/v1/_schemas/billing-errors";

const BILLING_TAGS = ["me", "billing"];

const CURSOR_NOTE =
  "Pass the `nextCursor` of a page as `cursor` to get the next one; `nextCursor` is `null` on the last page. 400 `invalid_cursor` when `cursor` is not one this API gave out.";

export const meBillingContract = {
  balance: {
    get: oc
      .errors(unauthorizedError)
      .route({
        method: "GET",
        path: "/me/billing/balance",
        spec: callerAccess("required"),
        summary: "The balance and how much of it is spent",
        description:
          "Both pools and the total, and the share spent since the last credit, which drives the low-balance warnings. Both are null for an account without a balance row. Needs an access token or a browser session.",
        tags: BILLING_TAGS,
      })
      .output(billingBalanceSchema),
  },

  transactions: {
    list: oc
      .errors({ ...unauthorizedError, ...billingListBadRequestWithReason })
      .route({
        method: "GET",
        path: "/me/billing/transactions",
        spec: callerAccess("required"),
        summary: "The balance transactions, newest first",
        description: `One page of the caller's transactions (credits and usage debits), with the total count. ${CURSOR_NOTE} Needs an access token or a browser session.`,
        tags: BILLING_TAGS,
      })
      .input(transactionListInputSchema)
      .output(transactionListSchema),
  },

  spendHistory: {
    get: oc
      .errors(unauthorizedError)
      .route({
        method: "GET",
        path: "/me/billing/spend-history",
        spec: callerAccess("required"),
        summary: "What the recent chats cost",
        description:
          "The chats with the most recent spend, rolled up from the latest 500 usage debits, and the spend of the last seven days. Not paged: it is a summary. Needs an access token or a browser session.",
        tags: BILLING_TAGS,
      })
      .input(spendHistoryInputSchema)
      .output(spendHistorySchema),
  },

  payments: {
    list: oc
      .errors({ ...unauthorizedError, ...billingListBadRequestWithReason })
      .route({
        method: "GET",
        path: "/me/billing/payments",
        spec: callerAccess("required"),
        summary: "The card charges, newest first",
        description: `One page of what the caller's card was charged: subscription purchases and renewals, and top-ups. Only real card payments are listed: a renewal without a card (a tester's, or the reset to zero when a subscription ends) is not. A refund does not remove or change a listed charge; it is a separate refund transaction in GET /me/billing/transactions. ${CURSOR_NOTE} Needs an access token or a browser session.`,
        tags: BILLING_TAGS,
      })
      .input(cardPaymentListInputSchema)
      .output(cardPaymentListSchema),
  },
};
