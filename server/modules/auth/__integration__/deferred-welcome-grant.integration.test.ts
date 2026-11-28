import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EMAIL_CONFIRM_BONUS_MAJOR_UNITS,
  WELCOME_GRANT_MAJOR_UNITS,
} from "@/lib/billing/constants";
import { db } from "@/server/db/connection";
import { balance, user } from "@/server/db/schema";
import { hashToken } from "@/server/modules/auth/reset-token";
import { verifyEmailCode } from "@/server/modules/auth/verify-email-code";
import {
  grantDeferredWelcomeBonus,
  grantEmailVerificationBonus,
} from "@/server/modules/billing/balance";
import {
  createUser,
  createUserWithDeferredWelcomeGrant,
} from "@/server/modules/users/queries/create-user";
import { markEmailAsVerified } from "@/server/modules/users/queries/mark-email-as-verified";
import { setEmailVerificationCode } from "@/server/modules/users/queries/set-email-verification-code";
import {
  closeDatabaseConnection,
  readBalance,
  readTransactions,
  readUsersByEmail,
  removeCurrency,
  resetMoneyTables,
  seedCurrency,
  TEST_CURRENCY_CODE,
} from "@/tests/integration/helpers";

const PASSWORD = "Integration-Passw0rd!";
const CODE = "123456";
const THIRTY_MINUTES_MS = 30 * 60 * 1000;

/** `seedCurrency` stores the test currency with two minor-unit digits. */
const WELCOME_MINOR = WELCOME_GRANT_MAJOR_UNITS * 100;
const EMAIL_BONUS_MINOR = EMAIL_CONFIRM_BONUS_MAJOR_UNITS * 100;

const PARALLEL_GRANTS = 4;

const uniqueEmail = (): string => `deferred-${randomUUID()}@example.test`;

const signUpThroughApi = async (email: string): Promise<string> => {
  const created = await createUserWithDeferredWelcomeGrant({
    email,
    password: PASSWORD,
    signupPlatform: "ios",
  });
  return created.id;
};

const sendCode = async (email: string): Promise<void> => {
  await setEmailVerificationCode({
    email,
    hashedCode: hashToken(CODE),
    expiresAt: new Date(Date.now() + THIRTY_MINUTES_MS),
  });
};

const transactionTypesOf = async (userId: string): Promise<string[]> =>
  (await readTransactions(userId)).map((entry) => entry.type).sort();

describe("the welcome grant of an API sign-up, against a real database", () => {
  beforeEach(async () => {
    await resetMoneyTables();
    await seedCurrency();
  });

  afterAll(async () => {
    await closeDatabaseConnection();
  });

  it("creates the account with its platform, a zero balance and no welcome grant", async () => {
    // Arrange
    const email = uniqueEmail();

    // Act
    const userId = await signUpThroughApi(email);

    // Assert
    const [stored] = await readUsersByEmail(email);
    expect(stored.signupPlatform).toBe("ios");
    expect(await readBalance(userId)).toMatchObject({
      topupAmount: 0,
      subscriptionAmount: 0,
    });
    expect(await readTransactions(userId)).toEqual([]);
  });

  it("credits the welcome grant and the email bonus, once each, when the email is verified", async () => {
    // Arrange
    const email = uniqueEmail();
    const userId = await signUpThroughApi(email);
    await sendCode(email);

    // Act
    const result = await verifyEmailCode({ email, code: CODE });

    // Assert
    expect(result).toEqual({
      status: "verified",
      isBonusGranted: true,
      isWelcomeGrantCredited: true,
    });
    expect(await transactionTypesOf(userId)).toEqual([
      "email_bonus",
      "welcome",
    ]);
    expect((await readBalance(userId)).topupAmount).toBe(
      WELCOME_MINOR + EMAIL_BONUS_MINOR
    );
  });

  it("writes the welcome grant as a website sign-up's: same amount, pool and description", async () => {
    // Arrange
    const apiEmail = uniqueEmail();
    const apiUserId = await signUpThroughApi(apiEmail);
    await markEmailAsVerified({ email: apiEmail });
    const websiteUser = await createUser(uniqueEmail(), PASSWORD);

    // Act
    await grantDeferredWelcomeBonus(apiUserId);

    // Assert
    const [deferred] = await readTransactions(apiUserId);
    const [immediate] = await readTransactions(websiteUser.id);
    expect(deferred).toMatchObject({
      type: "welcome",
      pool: "topup",
      amount: WELCOME_MINOR,
      currencyCode: TEST_CURRENCY_CODE,
      description: immediate.description,
      topupBalanceAfter: WELCOME_MINOR,
    });
    expect(deferred.amount).toBe(immediate.amount);
  });

  it("credits the welcome grant once under concurrent calls", async () => {
    // Arrange
    const email = uniqueEmail();
    const userId = await signUpThroughApi(email);
    await markEmailAsVerified({ email });

    // Act
    const grants = await Promise.all(
      Array.from({ length: PARALLEL_GRANTS }, () =>
        grantDeferredWelcomeBonus(userId)
      )
    );

    // Assert
    expect(grants.filter((grant) => grant !== null)).toHaveLength(1);
    expect(await transactionTypesOf(userId)).toEqual(["welcome"]);
    expect((await readBalance(userId)).topupAmount).toBe(WELCOME_MINOR);
  });

  it("credits nothing on a later call", async () => {
    // Arrange
    const email = uniqueEmail();
    const userId = await signUpThroughApi(email);
    await markEmailAsVerified({ email });
    await grantDeferredWelcomeBonus(userId);

    // Act
    const second = await grantDeferredWelcomeBonus(userId);

    // Assert
    expect(second).toBeNull();
    expect((await readBalance(userId)).topupAmount).toBe(WELCOME_MINOR);
  });

  it("credits nothing while the email is not verified", async () => {
    // Arrange
    const userId = await signUpThroughApi(uniqueEmail());

    // Act
    const grant = await grantDeferredWelcomeBonus(userId);

    // Assert
    expect(grant).toBeNull();
    expect(await readTransactions(userId)).toEqual([]);
  });

  it("leaves a website sign-up as it was: the grant at registration, only the bonus at verification", async () => {
    // Arrange
    const email = uniqueEmail();
    const created = await createUser(email, PASSWORD);
    const balanceAtSignUp = (await readBalance(created.id)).topupAmount;
    await sendCode(email);

    // Act
    const result = await verifyEmailCode({ email, code: CODE });

    // Assert
    expect(balanceAtSignUp).toBe(WELCOME_MINOR);
    expect(result).toEqual({
      status: "verified",
      isBonusGranted: true,
      isWelcomeGrantCredited: false,
    });
    expect(await transactionTypesOf(created.id)).toEqual([
      "email_bonus",
      "welcome",
    ]);
    expect((await readBalance(created.id)).topupAmount).toBe(
      WELCOME_MINOR + EMAIL_BONUS_MINOR
    );
  });

  it("pays no welcome grant to an older account that never had one", async () => {
    // Arrange: an account from before the welcome grant existed.
    const email = uniqueEmail();
    const [legacy] = await db
      .insert(user)
      .values({ email })
      .returning({ id: user.id });
    await db
      .insert(balance)
      .values({ userId: legacy.id, currencyCode: TEST_CURRENCY_CODE });
    await sendCode(email);

    // Act
    const result = await verifyEmailCode({ email, code: CODE });
    const direct = await grantDeferredWelcomeBonus(legacy.id);

    // Assert
    expect(result).toMatchObject({
      status: "verified",
      isWelcomeGrantCredited: false,
    });
    expect(direct).toBeNull();
    expect(await transactionTypesOf(legacy.id)).toEqual(["email_bonus"]);
    expect((await readBalance(legacy.id)).topupAmount).toBe(EMAIL_BONUS_MINOR);
  });

  it("leaves the email unverified when the grant cannot be written, and pays in full on the next try", async () => {
    // Arrange: make the grant fail. Without its balance row and without the
    // currency, the balance row cannot be created.
    const email = uniqueEmail();
    const userId = await signUpThroughApi(email);
    await sendCode(email);
    await db.delete(balance).where(eq(balance.userId, userId));
    await removeCurrency();
    const logged = vi.spyOn(console, "error").mockReturnValue(undefined);

    // Act
    const failed = verifyEmailCode({ email, code: CODE });

    // Assert: nothing half-done.
    await expect(failed).rejects.toThrow();
    const [afterFailure] = await readUsersByEmail(email);
    expect(afterFailure.emailVerified).toBe(false);
    expect(afterFailure.emailVerificationCode).not.toBeNull();
    expect(await readTransactions(userId)).toEqual([]);
    logged.mockRestore();

    // Act: the cause is gone; the same code is entered again.
    await seedCurrency();
    const retried = await verifyEmailCode({ email, code: CODE });

    // Assert
    expect(retried).toEqual({
      status: "verified",
      isBonusGranted: true,
      isWelcomeGrantCredited: true,
    });
    expect((await readBalance(userId)).topupAmount).toBe(
      WELCOME_MINOR + EMAIL_BONUS_MINOR
    );
  });

  it("keeps the email bonus single when both grants race at verification", async () => {
    // Arrange
    const email = uniqueEmail();
    const userId = await signUpThroughApi(email);
    await markEmailAsVerified({ email });

    // Act
    await Promise.all([
      grantDeferredWelcomeBonus(userId),
      grantEmailVerificationBonus(userId),
      grantDeferredWelcomeBonus(userId),
      grantEmailVerificationBonus(userId),
    ]);

    // Assert
    expect(await transactionTypesOf(userId)).toEqual([
      "email_bonus",
      "welcome",
    ]);
    expect((await readBalance(userId)).topupAmount).toBe(
      WELCOME_MINOR + EMAIL_BONUS_MINOR
    );
  });
});
