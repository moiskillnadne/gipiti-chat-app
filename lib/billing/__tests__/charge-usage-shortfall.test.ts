import { beforeEach, describe, expect, it, vi } from "vitest";

import { USAGE_MARKUP } from "../constants";

type BalanceRow = {
  userId: string;
  currencyCode: string;
  subscriptionAmount: number;
  topupAmount: number;
};

type InsertedTransaction = {
  amount: number;
  metadata?: Record<string, unknown>;
};

const { state, getCurrencyPricingMock } = vi.hoisted(() => ({
  state: {
    row: undefined as BalanceRow | undefined,
    inserted: [] as InsertedTransaction[],
  },
  getCurrencyPricingMock: vi.fn(),
}));

/** A transaction handle answering the select-for-update / update / insert chain. */
const buildTx = () => ({
  select: () => ({
    from: () => ({
      where: () => ({
        for: () => ({ limit: async () => (state.row ? [state.row] : []) }),
      }),
    }),
  }),
  update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
  insert: () => ({
    values: (values: InsertedTransaction) => {
      state.inserted.push(values);
      return { returning: async () => [{ id: "txn-1" }] };
    },
  }),
});

vi.mock("@/lib/db/connection", () => ({
  db: {
    transaction: async (
      run: (tx: ReturnType<typeof buildTx>) => Promise<unknown>
    ) => await run(buildTx()),
  },
}));
vi.mock("../fx", () => ({ getCurrencyPricing: getCurrencyPricingMock }));

import { chargeUsage } from "../balance";

describe("chargeUsage shortfall", () => {
  beforeEach(() => {
    state.inserted = [];
    getCurrencyPricingMock.mockResolvedValue({ minorUnits: 2, fxRate: 100 });
  });

  it("records the uncharged remainder when the cost exceeds the balance", async () => {
    // Arrange: $1 × 100 × markup = 200 RUB = 20 000 kopecks against 5 000.
    state.row = {
      userId: "user-1",
      currencyCode: "RUB",
      subscriptionAmount: 3000,
      topupAmount: 2000,
    };
    const requestedMinor = 1 * 100 * USAGE_MARKUP * 100;
    const warn = vi.spyOn(console, "warn").mockImplementation(vi.fn());

    // Act
    const result = await chargeUsage({
      userId: "user-1",
      usdCost: 1,
      chatId: "chat-1",
      modelId: "veo-3.1",
    });

    // Assert
    expect(result?.amount).toBe(5000);
    expect(state.inserted[0].amount).toBe(-5000);
    expect(state.inserted[0].metadata).toEqual({
      requestedAmount: requestedMinor,
      shortfallAmount: requestedMinor - 5000,
    });
    expect(warn).toHaveBeenCalledWith(
      "[billing] usage charge floored at zero",
      expect.objectContaining({
        userId: "user-1",
        chatId: "chat-1",
        modelId: "veo-3.1",
        currencyCode: "RUB",
        requestedAmount: requestedMinor,
        chargedAmount: 5000,
        shortfallAmount: requestedMinor - 5000,
        transactionId: "txn-1",
      })
    );
    warn.mockRestore();
  });

  it("writes no shortfall when the balance covers the cost", async () => {
    state.row = {
      userId: "user-1",
      currencyCode: "RUB",
      subscriptionAmount: 50_000,
      topupAmount: 0,
    };
    const warn = vi.spyOn(console, "warn").mockImplementation(vi.fn());

    await chargeUsage({ userId: "user-1", usdCost: 1 });

    expect(state.inserted[0].metadata).toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
