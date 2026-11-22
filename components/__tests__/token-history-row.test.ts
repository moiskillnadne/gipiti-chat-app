import { describe, expect, it } from "vitest";

import { type Transaction, toHistoryRow } from "@/components/token-history-row";

const DATE_LABEL_PATTERN = /^Nov 20, 2026 \d{2}:\d{2}$/;

const baseTransaction: Transaction = {
  id: "tx-1",
  type: "usage_debit",
  pool: "topup",
  currencyCode: "RUB",
  amount: -13_722,
  createdAt: "2026-11-20T12:10:00.000Z",
  modelId: "openai/gpt-5",
  chatTitle: "Бумажный кораблик",
  description: "ignored when a chat title exists",
};

describe("toHistoryRow", () => {
  it("formats a debit with a minus sign, the currency and the debit colour", () => {
    const row = toHistoryRow(baseTransaction);

    expect(row.amountLabel).toBe("-137,22 ₽");
    expect(row.amountClassName).toBe("text-ink");
  });

  it("formats a credit with a plus sign and the credit colour", () => {
    const row = toHistoryRow({
      ...baseTransaction,
      type: "topup_purchase",
      amount: 50_000,
    });

    expect(row.amountLabel).toBe("+500 ₽");
    expect(row.amountClassName).toBe("text-success-ink");
  });

  it("uses the chat title, then the description, then nothing as the row title", () => {
    expect(toHistoryRow(baseTransaction).title).toBe("Бумажный кораблик");
    expect(toHistoryRow({ ...baseTransaction, chatTitle: null }).title).toBe(
      "ignored when a chat title exists"
    );
    expect(
      toHistoryRow({ ...baseTransaction, chatTitle: null, description: null })
        .title
    ).toBe(null);
  });

  it("keeps the raw timestamp for <time> next to the display label", () => {
    const row = toHistoryRow(baseTransaction);

    expect(row.createdAt).toBe(baseTransaction.createdAt);
    expect(row.dateLabel).toMatch(DATE_LABEL_PATTERN);
  });
});
