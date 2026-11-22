/**
 * `createUser` writes the user, the balance row and the welcome grant in one
 * transaction, and every query must go through it (GIPITI-230). A query
 * through the global `db` inside the callback would commit apart from the rest
 * and take a second pool connection.
 *
 * The billing modules are real here; only the connection is replaced, by a
 * `db` whose direct queries throw and whose transaction answers from memory.
 * That the writes roll back together is covered on a real database, in
 * `__integration__/create-user.integration.test.ts`.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WELCOME_GRANT_MAJOR_UNITS } from "@/lib/billing/constants";
import { ChatSDKError } from "@/lib/errors";
import { balance, currency, user } from "@/server/db/schema";

type StoredRow = Record<string, unknown>;

type TransactionCallback = (tx: unknown) => Promise<unknown>;

const USER_ID = "11111111-1111-4111-8111-111111111111";
const EMAIL = "new.user@example.com";
const PASSWORD = "Password1!";
const RUB_MINOR_UNITS = 2;
const UNIQUE_VIOLATION = "23505";

// Hoisted with the mock factories below, which run before this module's body.
const { state, rejectGlobalQuery } = vi.hoisted(() => ({
  state: {
    currencyRows: [] as StoredRow[],
    balanceRows: [] as StoredRow[],
    insertedUsers: [] as StoredRow[],
    insertedTransactions: [] as StoredRow[],
    userInsertError: null as Error | null,
    transactionInsertError: null as Error | null,
    openedTransactions: 0,
    openedSavepoints: 0,
  },
  rejectGlobalQuery: (): never => {
    throw new Error("A query ran through the global db inside a transaction");
  },
}));

const rowsOf = (table: unknown): StoredRow[] => {
  if (table === balance) {
    return state.balanceRows;
  }
  if (table === currency) {
    return state.currencyRows;
  }
  return [];
};

/** Answers `where / for / limit` chains with the table's rows. */
const buildSelectQuery = (rows: StoredRow[]) => {
  const query = {
    where: () => query,
    for: () => query,
    limit: async () => rows,
  };
  return query;
};

const insertUserRow = (values: StoredRow): StoredRow[] => {
  if (state.userInsertError) {
    throw state.userInsertError;
  }
  const row = { id: USER_ID, ...values };
  state.insertedUsers.push(row);
  return [row];
};

const insertTransactionRow = (values: StoredRow): StoredRow[] => {
  if (state.transactionInsertError) {
    throw state.transactionInsertError;
  }
  state.insertedTransactions.push(values);
  return [{ id: "txn-1" }];
};

const buildInsert = (table: unknown, values: StoredRow) => ({
  returning: async () =>
    table === user ? insertUserRow(values) : insertTransactionRow(values),
  onConflictDoNothing: (): Promise<void> => {
    if (table !== balance) {
      return Promise.reject(
        new Error("Only the balance insert may skip a conflict")
      );
    }
    state.balanceRows.push({
      subscriptionAmount: 0,
      topupAmount: 0,
      ...values,
    });
    return Promise.resolve();
  },
});

const buildTx = () => ({
  select: () => ({
    from: (table: unknown) => buildSelectQuery(rowsOf(table)),
  }),
  insert: (table: unknown) => ({
    values: (values: StoredRow) => buildInsert(table, values),
  }),
  update: () => ({
    set: (values: StoredRow) => ({
      where: (): Promise<void> => {
        Object.assign(state.balanceRows[0], values);
        return Promise.resolve();
      },
    }),
  }),
  // A transaction opened on a transaction is a savepoint.
  transaction: async (run: TransactionCallback) => {
    state.openedSavepoints += 1;
    return await run(buildTx());
  },
});

vi.mock("@/server/db/connection", () => ({
  db: {
    select: rejectGlobalQuery,
    insert: rejectGlobalQuery,
    update: rejectGlobalQuery,
    execute: rejectGlobalQuery,
    transaction: async (run: TransactionCallback) => {
      state.openedTransactions += 1;
      return await run(buildTx());
    },
  },
}));
// bcrypt is slow on purpose; the hash itself is not under test.
vi.mock("@/server/db/utils", () => ({
  generateHashedPassword: (password: string) => `hashed:${password}`,
}));

import {
  createUser,
  DuplicateEmailError,
} from "@/server/modules/users/queries/create-user";

/** The shape Drizzle gives a rejected insert: the driver error is the cause. */
const uniqueViolation = (): Error =>
  new Error("Failed query", {
    cause: Object.assign(new Error("duplicate key value"), {
      code: UNIQUE_VIOLATION,
    }),
  });

describe("createUser", () => {
  beforeEach(() => {
    state.currencyRows = [{ code: "RUB", minorUnits: RUB_MINOR_UNITS }];
    state.balanceRows = [];
    state.insertedUsers = [];
    state.insertedTransactions = [];
    state.userInsertError = null;
    state.transactionInsertError = null;
    state.openedTransactions = 0;
    state.openedSavepoints = 0;
  });

  it("writes the user, the balance row and the grant through one transaction", async () => {
    // Arrange
    const grantMinor = WELCOME_GRANT_MAJOR_UNITS * 10 ** RUB_MINOR_UNITS;

    // Act: any query through the global db would throw.
    const createdUser = await createUser(` ${EMAIL.toUpperCase()} `, PASSWORD);

    // Assert
    expect(createdUser).toMatchObject({ id: USER_ID, email: EMAIL });
    expect(state.insertedUsers).toEqual([
      { id: USER_ID, email: EMAIL, password: `hashed:${PASSWORD}` },
    ]);
    expect(state.balanceRows).toHaveLength(1);
    expect(state.balanceRows[0]).toMatchObject({
      userId: USER_ID,
      currencyCode: "RUB",
      subscriptionAmount: 0,
      topupAmount: grantMinor,
    });
    expect(state.insertedTransactions).toHaveLength(1);
    expect(state.insertedTransactions[0]).toMatchObject({
      userId: USER_ID,
      type: "welcome",
      pool: "topup",
      amount: grantMinor,
      currencyCode: "RUB",
      subscriptionBalanceAfter: 0,
      topupBalanceAfter: grantMinor,
    });
    // The credit is a savepoint of the one transaction, not a second one.
    expect(state.openedTransactions).toBe(1);
    expect(state.openedSavepoints).toBe(1);
  });

  it("stores UTM and registration geo on the user row", async () => {
    // Act
    await createUser(
      EMAIL,
      PASSWORD,
      {
        utmSource: "newsletter",
        utmMedium: "email",
        utmCampaign: "launch",
        utmContent: "header",
        utmTerm: "ai",
      },
      { country: "RU", region: "MOW", city: "Moscow", language: "ru" }
    );

    // Assert
    expect(state.insertedUsers[0]).toMatchObject({
      utmSource: "newsletter",
      utmMedium: "email",
      utmCampaign: "launch",
      utmContent: "header",
      utmTerm: "ai",
      registrationCountry: "RU",
      registrationRegion: "MOW",
      registrationCity: "Moscow",
      registrationLanguage: "ru",
    });
  });

  it("sizes the grant with the currency's minor-unit exponent", async () => {
    // Arrange: a currency without minor units, read through the transaction.
    state.currencyRows = [{ code: "RUB", minorUnits: 0 }];

    // Act
    await createUser(EMAIL, PASSWORD);

    // Assert
    expect(state.insertedTransactions[0].amount).toBe(
      WELCOME_GRANT_MAJOR_UNITS
    );
  });

  it("throws DuplicateEmailError for a taken email and grants nothing", async () => {
    // Arrange
    state.userInsertError = uniqueViolation();

    // Act
    const attempt = createUser(EMAIL, PASSWORD);

    // Assert
    await expect(attempt).rejects.toBeInstanceOf(DuplicateEmailError);
    expect(state.balanceRows).toHaveLength(0);
    expect(state.insertedTransactions).toHaveLength(0);
  });

  it("reports any other insert failure as a database error", async () => {
    // Arrange
    state.userInsertError = new Error("connection reset");

    // Act
    const attempt = createUser(EMAIL, PASSWORD);

    // Assert
    await expect(attempt).rejects.toBeInstanceOf(ChatSDKError);
    expect(state.balanceRows).toHaveLength(0);
    expect(state.insertedTransactions).toHaveLength(0);
  });

  it("rejects when the grant fails, so the transaction rolls back", async () => {
    // Arrange
    const grantFailure = new Error("grant insert failed");
    state.transactionInsertError = grantFailure;

    // Act
    const attempt = createUser(EMAIL, PASSWORD);

    // Assert: the error leaves the transaction callback, which is what makes
    // the driver roll the user insert back.
    await expect(attempt).rejects.toBe(grantFailure);
  });
});
