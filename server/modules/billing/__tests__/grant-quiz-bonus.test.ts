import { beforeEach, describe, expect, it, vi } from "vitest";

import { balance, transaction, user } from "@/server/db/schema";

type BalanceRow = {
  userId: string;
  currencyCode: string;
  subscriptionAmount: number;
  topupAmount: number;
};

type TransactionRow = {
  id: string;
  userId: string;
  type: string;
  amount: number;
  referenceId?: string;
};

type FakeDbState = {
  isEmailVerified: boolean;
  balanceRow: BalanceRow;
  transactions: TransactionRow[];
};

// In-memory stand-in for the Drizzle client. Rows are picked by the table
// passed to `from()`; `where()` filters are not interpreted, which is enough
// because each test works with one user and one quiz key.
const fakeDb = vi.hoisted(() => {
  const state: FakeDbState = {
    isEmailVerified: false,
    balanceRow: {
      userId: "",
      currencyCode: "RUB",
      subscriptionAmount: 0,
      topupAmount: 0,
    },
    transactions: [],
  };
  const tables: { user?: unknown; balance?: unknown; transaction?: unknown } =
    {};

  const rowsFor = (table: unknown): unknown[] => {
    if (table === tables.user) {
      return [{ emailVerified: state.isEmailVerified }];
    }
    if (table === tables.balance) {
      return [{ ...state.balanceRow }];
    }
    if (table === tables.transaction) {
      return state.transactions
        .filter((row) => row.type === "quiz_bonus")
        .map((row) => ({ id: row.id }));
    }
    return [];
  };

  const select = () => {
    let selectedTable: unknown;
    const builder = {
      from: (table: unknown) => {
        selectedTable = table;
        return builder;
      },
      where: () => builder,
      for: () => builder,
      limit: (): Promise<unknown[]> => Promise.resolve(rowsFor(selectedTable)),
    };
    return builder;
  };

  const update = () => ({
    set: (values: Partial<BalanceRow>) => ({
      where: (): Promise<void> => {
        Object.assign(state.balanceRow, values);
        return Promise.resolve();
      },
    }),
  });

  const insert = () => ({
    values: (values: Omit<TransactionRow, "id">) => ({
      returning: (): Promise<{ id: string }[]> => {
        const row = { ...values, id: `tx-${state.transactions.length + 1}` };
        state.transactions.push(row);
        return Promise.resolve([{ id: row.id }]);
      },
    }),
  });

  const client = {
    select,
    update,
    insert,
    transaction: vi.fn(
      async (callback: (tx: unknown) => Promise<unknown>) =>
        await callback({ select, update, insert })
    ),
  };

  return { state, tables, client };
});

vi.mock("@/server/db/connection", () => ({ db: fakeDb.client }));
vi.mock("@/server/modules/billing/currencies", () => ({
  getMinorUnits: vi.fn(async () => 2),
}));
vi.mock("@/server/modules/billing/fx", () => ({ getLatestFxRate: vi.fn() }));

import { grantQuizBonus } from "../balance";
import { EmailNotVerifiedError } from "../email-verification";

const USER_ID = "user-1";
const QUIZ_KEY = "onboarding";
const BONUS_MAJOR_UNITS = 50;
const BONUS_MINOR_UNITS = 5000;

describe("grantQuizBonus", () => {
  beforeEach(() => {
    fakeDb.tables.user = user;
    fakeDb.tables.balance = balance;
    fakeDb.tables.transaction = transaction;
    fakeDb.state.isEmailVerified = false;
    fakeDb.state.balanceRow = {
      userId: USER_ID,
      currencyCode: "RUB",
      subscriptionAmount: 0,
      topupAmount: 1000,
    };
    fakeDb.state.transactions = [];
    fakeDb.client.transaction.mockClear();
  });

  it("refuses an unverified user without crediting or writing a ledger row", async () => {
    // Arrange
    fakeDb.state.isEmailVerified = false;

    // Act
    const grant = grantQuizBonus(USER_ID, QUIZ_KEY, BONUS_MAJOR_UNITS);

    // Assert
    await expect(grant).rejects.toBeInstanceOf(EmailNotVerifiedError);
    expect(fakeDb.state.balanceRow.topupAmount).toBe(1000);
    expect(fakeDb.state.transactions).toHaveLength(0);
    expect(fakeDb.client.transaction).not.toHaveBeenCalled();
  });

  it("credits a verified user once with a quiz_bonus ledger row", async () => {
    // Arrange
    fakeDb.state.isEmailVerified = true;

    // Act
    const result = await grantQuizBonus(USER_ID, QUIZ_KEY, BONUS_MAJOR_UNITS);

    // Assert
    expect(result).toMatchObject({
      amount: BONUS_MINOR_UNITS,
      topupBalanceAfter: 1000 + BONUS_MINOR_UNITS,
    });
    expect(fakeDb.state.balanceRow.topupAmount).toBe(1000 + BONUS_MINOR_UNITS);
    expect(fakeDb.state.transactions).toEqual([
      expect.objectContaining({
        type: "quiz_bonus",
        referenceId: QUIZ_KEY,
        amount: BONUS_MINOR_UNITS,
      }),
    ]);
  });

  it("does not credit a verified user a second time for the same quiz", async () => {
    // Arrange
    fakeDb.state.isEmailVerified = true;
    await grantQuizBonus(USER_ID, QUIZ_KEY, BONUS_MAJOR_UNITS);

    // Act
    const secondResult = await grantQuizBonus(
      USER_ID,
      QUIZ_KEY,
      BONUS_MAJOR_UNITS
    );

    // Assert
    expect(secondResult).toBeNull();
    expect(fakeDb.state.balanceRow.topupAmount).toBe(1000 + BONUS_MINOR_UNITS);
    expect(fakeDb.state.transactions).toHaveLength(1);
  });
});
