import { requireAuth } from "@/server/api/_kit/middleware";
import { decodeCursor, encodeCursor } from "@/server/api/_kit/pagination";
import {
  toCardPaymentDto,
  toChatSpendDto,
  toMoney,
  toTransactionDto,
} from "@/server/api/v1/_mappers/billing";
import { toBalanceDto } from "@/server/api/v1/_mappers/me";
import { v1 } from "@/server/api/v1/implementer";
import { getBillingBalance } from "@/server/modules/billing/get-billing-balance";
import { getSpendHistory } from "@/server/modules/billing/get-spend-history";
import { listCardPayments } from "@/server/modules/billing/list-card-payments";
import { listTransactions } from "@/server/modules/billing/list-transactions";

export const meBillingRouter = {
  balance: {
    get: v1.me.billing.balance.get
      .use(requireAuth)
      .handler(async ({ context }) => {
        const { balance, spend } = await getBillingBalance(
          context.principal.userId
        );

        return {
          balance: balance ? toBalanceDto(balance) : null,
          spend: spend
            ? { spentPercent: spend.spentPercent, epochKey: spend.epochKey }
            : null,
        };
      }),
  },

  transactions: {
    list: v1.me.billing.transactions.list
      .use(requireAuth)
      .handler(async ({ input, context, errors }) => {
        const decoded =
          input.cursor === undefined ? null : decodeCursor(input.cursor);
        if (decoded?.status === "invalid") {
          throw errors.BAD_REQUEST({ data: { reason: "invalid_cursor" } });
        }

        const page = await listTransactions({
          userId: context.principal.userId,
          limit: input.limit,
          after: decoded?.position ?? null,
        });
        const lastTransaction = page.transactions.at(-1);

        return {
          items: page.transactions.map(toTransactionDto),
          nextCursor:
            page.hasMore && lastTransaction
              ? encodeCursor({
                  createdAt: lastTransaction.createdAtText,
                  id: lastTransaction.id,
                })
              : null,
          totalCount: page.totalCount,
        };
      }),
  },

  spendHistory: {
    get: v1.me.billing.spendHistory.get
      .use(requireAuth)
      .handler(async ({ input, context }) => {
        const history = await getSpendHistory({
          userId: context.principal.userId,
          limit: input.limit,
        });

        return {
          items: history.chats.map((row) =>
            toChatSpendDto(row, history.currencyCode)
          ),
          recentSpend: toMoney(history.recentSpendMinor, history.currencyCode),
        };
      }),
  },

  payments: {
    list: v1.me.billing.payments.list
      .use(requireAuth)
      .handler(async ({ input, context, errors }) => {
        const decoded =
          input.cursor === undefined ? null : decodeCursor(input.cursor);
        if (decoded?.status === "invalid") {
          throw errors.BAD_REQUEST({ data: { reason: "invalid_cursor" } });
        }

        const page = await listCardPayments({
          userId: context.principal.userId,
          limit: input.limit,
          after: decoded?.position ?? null,
        });
        const lastPayment = page.payments.at(-1);

        return {
          items: page.payments.map(toCardPaymentDto),
          nextCursor:
            page.hasMore && lastPayment
              ? encodeCursor({
                  createdAt: lastPayment.createdAtText,
                  id: lastPayment.id,
                })
              : null,
        };
      }),
  },
};
