import { randomUUID } from "node:crypto";

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  DEFAULT_CURRENCY_CODE,
  WELCOME_GRANT_MAJOR_UNITS,
} from "@/lib/billing/constants";
import {
  createUser,
  DuplicateEmailError,
} from "@/lib/db/query/user/create-user";
import {
  closeDatabaseConnection,
  readBalance,
  readTransactions,
  readUsersByEmail,
  removeCurrency,
  resetMoneyTables,
  seedCurrency,
} from "@/tests/integration/helpers";

const PASSWORD = "Integration-Passw0rd!";

/** `seedCurrency` stores the test currency with two minor-unit digits. */
const WELCOME_GRANT_MINOR_UNITS = WELCOME_GRANT_MAJOR_UNITS * 100;

/** SQLSTATE Postgres raises when a row points at a missing parent row. */
const FOREIGN_KEY_VIOLATION = "23503";

const MAX_CAUSE_DEPTH = 10;

const uniqueEmail = (): string => `signup-${randomUUID()}@example.test`;

/** SQLSTATE of a failed query: Drizzle keeps the driver error on `.cause`. */
const sqlStateOf = (error: unknown): string | undefined => {
  let current: unknown = error;

  for (let depth = 0; depth < MAX_CAUSE_DEPTH; depth++) {
    if (!(current instanceof Error)) {
      return;
    }
    if ("code" in current && typeof current.code === "string") {
      return current.code;
    }
    current = current.cause;
  }
};

describe("createUser against a real database", () => {
  beforeEach(async () => {
    await resetMoneyTables();
    await seedCurrency();
  });

  afterAll(async () => {
    await closeDatabaseConnection();
  });

  it("creates the user, the balance row and the welcome grant together", async () => {
    // Arrange
    const email = uniqueEmail();

    // Act
    const createdUser = await createUser(email, PASSWORD);

    // Assert
    const storedUsers = await readUsersByEmail(email);
    expect(storedUsers).toHaveLength(1);
    expect(storedUsers[0].id).toBe(createdUser.id);
    expect(storedUsers[0].password).not.toBe(PASSWORD);

    expect(await readBalance(createdUser.id)).toMatchObject({
      currencyCode: DEFAULT_CURRENCY_CODE,
      subscriptionAmount: 0,
      topupAmount: WELCOME_GRANT_MINOR_UNITS,
    });

    const transactions = await readTransactions(createdUser.id);
    expect(transactions).toHaveLength(1);
    expect(transactions[0]).toMatchObject({
      type: "welcome",
      pool: "topup",
      amount: WELCOME_GRANT_MINOR_UNITS,
      currencyCode: DEFAULT_CURRENCY_CODE,
      subscriptionBalanceAfter: 0,
      topupBalanceAfter: WELCOME_GRANT_MINOR_UNITS,
    });
  });

  it("stores the email in its normalized form", async () => {
    // Arrange
    const normalizedEmail = uniqueEmail();

    // Act
    const createdUser = await createUser(
      `  ${normalizedEmail.toUpperCase()} `,
      PASSWORD
    );

    // Assert
    expect(createdUser.email).toBe(normalizedEmail);
    expect(await readUsersByEmail(normalizedEmail)).toHaveLength(1);
  });

  it("leaves no user behind when the grant cannot be written", async () => {
    // Arrange: without its `Currency` row the default currency cannot be
    // referenced, so the `Balance` insert that follows the `User` insert
    // violates the `currency_code` foreign key. That is the first write of the
    // grant, and it fails every time.
    const email = uniqueEmail();
    await removeCurrency(DEFAULT_CURRENCY_CODE);

    // Act
    const failure: unknown = await createUser(email, PASSWORD).catch(
      (error: unknown) => error
    );

    // Assert: the user insert had succeeded and was rolled back. `Balance` and
    // `Transaction` rows cannot outlive it: both reference the user.
    expect(sqlStateOf(failure)).toBe(FOREIGN_KEY_VIOLATION);
    expect(await readUsersByEmail(email)).toHaveLength(0);
  });

  it("lets the same email sign up after a failed attempt", async () => {
    // Arrange: a first attempt that fails on the grant (see the test above).
    const email = uniqueEmail();
    await removeCurrency(DEFAULT_CURRENCY_CODE);
    await createUser(email, PASSWORD).catch((error: unknown) => error);
    await seedCurrency(DEFAULT_CURRENCY_CODE);

    // Act
    const createdUser = await createUser(email, PASSWORD);

    // Assert
    expect(await readUsersByEmail(email)).toHaveLength(1);
    expect((await readBalance(createdUser.id)).topupAmount).toBe(
      WELCOME_GRANT_MINOR_UNITS
    );
    expect(await readTransactions(createdUser.id)).toHaveLength(1);
  });

  it("throws DuplicateEmailError for a taken email and grants nothing more", async () => {
    // Arrange
    const email = uniqueEmail();
    const firstUser = await createUser(email, PASSWORD);

    // Act
    const secondAttempt = createUser(email.toUpperCase(), PASSWORD);

    // Assert
    await expect(secondAttempt).rejects.toBeInstanceOf(DuplicateEmailError);
    expect(await readUsersByEmail(email)).toHaveLength(1);
    expect((await readBalance(firstUser.id)).topupAmount).toBe(
      WELCOME_GRANT_MINOR_UNITS
    );
    expect(await readTransactions(firstUser.id)).toHaveLength(1);
  });

  it("lets one of two concurrent sign-ups with the same email through", async () => {
    // Arrange
    const email = uniqueEmail();

    // Act: the second insert waits on the unique index until the first
    // transaction commits, then fails.
    const outcomes = await Promise.allSettled([
      createUser(email, PASSWORD),
      createUser(email, PASSWORD),
    ]);

    // Assert
    const fulfilled = outcomes.filter(({ status }) => status === "fulfilled");
    const rejected = outcomes.filter(
      (outcome): outcome is PromiseRejectedResult =>
        outcome.status === "rejected"
    );
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(DuplicateEmailError);

    const storedUsers = await readUsersByEmail(email);
    expect(storedUsers).toHaveLength(1);
    expect(await readTransactions(storedUsers[0].id)).toHaveLength(1);
  });
});
