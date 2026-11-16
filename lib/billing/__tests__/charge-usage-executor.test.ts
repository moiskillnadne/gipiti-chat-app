/**
 * `chargeUsage` must run every query on its transaction (GIPITI-228). A query
 * through the global `db` inside the transaction callback takes a second pool
 * connection, and a pool's worth of concurrent charges then deadlocks.
 *
 * The pricing modules are real here; only the connection is replaced, by a
 * `db` whose direct queries throw and whose transaction answers from memory.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { USAGE_MARKUP } from "@/lib/billing/constants";
import { balance, currency, fxRate } from "@/lib/db/schema";

type InsertedTransaction = {
  amount: number;
  fxRate: string;
};

const RUB_PER_USD = 100;
const RUB_MINOR_UNITS = 2;

// Hoisted with the mock factory below, which runs before this module's body.
const { state, rejectGlobalQuery } = vi.hoisted(() => ({
  state: {
    rowsByTable: new Map<unknown, unknown[]>(),
    inserted: [] as InsertedTransaction[],
  },
  rejectGlobalQuery: (): never => {
    throw new Error("A query ran through the global db inside a transaction");
  },
}));

/** Answers `where / for / orderBy / limit` chains with the table's rows. */
const buildSelectQuery = (rows: unknown[]) => {
  const query = {
    where: () => query,
    for: () => query,
    orderBy: () => query,
    limit: async () => rows,
  };
  return query;
};

const buildTx = () => ({
  select: () => ({
    from: (table: unknown) =>
      buildSelectQuery(state.rowsByTable.get(table) ?? []),
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
    select: rejectGlobalQuery,
    insert: rejectGlobalQuery,
    update: rejectGlobalQuery,
    execute: rejectGlobalQuery,
    transaction: async (
      run: (tx: ReturnType<typeof buildTx>) => Promise<unknown>
    ) => await run(buildTx()),
  },
}));

import { chargeUsage } from "@/lib/billing/balance";

describe("chargeUsage query executor", () => {
  beforeEach(() => {
    state.inserted = [];
    state.rowsByTable = new Map<unknown, unknown[]>([
      [
        balance,
        [
          {
            userId: "user-1",
            currencyCode: "RUB",
            subscriptionAmount: 0,
            topupAmount: 1_000_000,
          },
        ],
      ],
      [currency, [{ code: "RUB", minorUnits: RUB_MINOR_UNITS }]],
      [fxRate, [{ rate: String(RUB_PER_USD) }]],
    ]);
  });

  it("reads the currency and the FX rate through the transaction", async () => {
    // Arrange: $1 × 100 RUB × markup, in kopecks.
    const expectedMinor =
      1 * RUB_PER_USD * USAGE_MARKUP * 10 ** RUB_MINOR_UNITS;

    // Act: a lookup through the global db would throw.
    const result = await chargeUsage({ userId: "user-1", usdCost: 1 });

    // Assert
    expect(result?.amount).toBe(expectedMinor);
    expect(state.inserted).toHaveLength(1);
    expect(state.inserted[0].amount).toBe(-expectedMinor);
    expect(state.inserted[0].fxRate).toBe(String(RUB_PER_USD));
  });

  it("charges nothing when the transaction finds no FX rate", async () => {
    // Arrange
    state.rowsByTable.set(fxRate, []);

    // Act
    const result = await chargeUsage({ userId: "user-1", usdCost: 1 });

    // Assert
    expect(result).toBeNull();
    expect(state.inserted).toHaveLength(0);
  });
});
