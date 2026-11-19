import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { markEmailAsVerified } from "@/lib/db/query/user/mark-email-as-verified";
import { setEmailVerificationCode } from "@/lib/db/query/user/set-email-verification-code";
import {
  MAX_EMAIL_VERIFICATION_ATTEMPTS,
  takeVerificationAttempt,
} from "@/lib/db/query/user/take-verification-attempt";
import { db } from "@/server/db/connection";
import { user } from "@/server/db/schema";
import {
  closeDatabaseConnection,
  resetMoneyTables,
} from "@/tests/integration/helpers";

const USER_EMAIL = "verify@example.test";
const HASHED_CODE = "a".repeat(64);
const NEW_HASHED_CODE = "b".repeat(64);
const THIRTY_MINUTES_MS = 30 * 60 * 1000;

/** More guesses at once than the cap allows. */
const PARALLEL_GUESSES = MAX_EMAIL_VERIFICATION_ATTEMPTS + 3;

type SeedUserInput = {
  emailVerified?: boolean;
  hashedCode?: string | null;
  expiresAt?: Date | null;
};

const inThirtyMinutes = (): Date => new Date(Date.now() + THIRTY_MINUTES_MS);

const seedUser = async ({
  emailVerified = false,
  hashedCode = HASHED_CODE,
  expiresAt = inThirtyMinutes(),
}: SeedUserInput = {}): Promise<string> => {
  const [created] = await db
    .insert(user)
    .values({
      email: USER_EMAIL,
      emailVerified,
      emailVerificationCode: hashedCode,
      emailVerificationCodeExpiry: expiresAt,
    })
    .returning({ id: user.id });

  return created.id;
};

const readAttempts = async (userId: string): Promise<number> => {
  const [row] = await db
    .select({ attempts: user.emailVerificationAttempts })
    .from(user)
    .where(eq(user.id, userId));

  return row.attempts;
};

describe("takeVerificationAttempt against a real database", () => {
  beforeEach(async () => {
    await resetMoneyTables();
  });

  afterAll(async () => {
    await closeDatabaseConnection();
  });

  it("hands out the stored hash five times, then nothing", async () => {
    // Arrange
    const userId = await seedUser();

    // Act
    const attempts: Awaited<ReturnType<typeof takeVerificationAttempt>>[] = [];
    for (let guess = 0; guess <= MAX_EMAIL_VERIFICATION_ATTEMPTS; guess++) {
      attempts.push(await takeVerificationAttempt({ email: USER_EMAIL }));
    }

    // Assert
    const taken = attempts.slice(0, MAX_EMAIL_VERIFICATION_ATTEMPTS);
    expect(taken.map((attempt) => attempt?.attemptsUsed)).toEqual([
      1, 2, 3, 4, 5,
    ]);
    expect(taken.every((attempt) => attempt?.hashedCode === HASHED_CODE)).toBe(
      true
    );
    expect(taken.every((attempt) => attempt?.userId === userId)).toBe(true);
    expect(attempts.at(-1)).toBeNull();
    expect(await readAttempts(userId)).toBe(MAX_EMAIL_VERIFICATION_ATTEMPTS);
  });

  it("lets parallel guesses use exactly five attempts", async () => {
    // Arrange
    const userId = await seedUser();

    // Act
    const attempts = await Promise.all(
      Array.from({ length: PARALLEL_GUESSES }, () =>
        takeVerificationAttempt({ email: USER_EMAIL })
      )
    );

    // Assert
    const taken = attempts.filter((attempt) => attempt !== null);
    expect(taken).toHaveLength(MAX_EMAIL_VERIFICATION_ATTEMPTS);
    expect(
      taken.map((attempt) => attempt.attemptsUsed).sort((a, b) => a - b)
    ).toEqual([1, 2, 3, 4, 5]);
    expect(await readAttempts(userId)).toBe(MAX_EMAIL_VERIFICATION_ATTEMPTS);
  });

  it("matches the email without regard to case", async () => {
    // Arrange
    await seedUser();

    // Act
    const attempt = await takeVerificationAttempt({
      email: "Verify@Example.TEST",
    });

    // Assert
    expect(attempt?.hashedCode).toBe(HASHED_CODE);
  });

  it.each<[string, SeedUserInput]>([
    ["the account is already verified", { emailVerified: true }],
    ["the account has no code", { hashedCode: null, expiresAt: null }],
    ["the code has expired", { expiresAt: new Date(Date.now() - 1000) }],
  ])("takes nothing when %s", async (_label, seed) => {
    // Arrange
    const userId = await seedUser(seed);

    // Act
    const attempt = await takeVerificationAttempt({ email: USER_EMAIL });

    // Assert
    expect(attempt).toBeNull();
    expect(await readAttempts(userId)).toBe(0);
  });

  it("takes nothing for an email without an account", async () => {
    // Act
    const attempt = await takeVerificationAttempt({ email: USER_EMAIL });

    // Assert
    expect(attempt).toBeNull();
  });

  it("gives a new code a fresh set of attempts", async () => {
    // Arrange
    const userId = await seedUser();
    for (let guess = 0; guess < MAX_EMAIL_VERIFICATION_ATTEMPTS; guess++) {
      await takeVerificationAttempt({ email: USER_EMAIL });
    }

    // Act
    await setEmailVerificationCode({
      email: USER_EMAIL,
      hashedCode: NEW_HASHED_CODE,
      expiresAt: inThirtyMinutes(),
    });
    const attempt = await takeVerificationAttempt({ email: USER_EMAIL });

    // Assert
    expect(attempt).toEqual({
      userId,
      hashedCode: NEW_HASHED_CODE,
      attemptsUsed: 1,
    });
  });

  it("clears the counter when the email is verified", async () => {
    // Arrange
    const userId = await seedUser();
    await takeVerificationAttempt({ email: USER_EMAIL });

    // Act
    await markEmailAsVerified({ email: USER_EMAIL });

    // Assert
    expect(await readAttempts(userId)).toBe(0);
    expect(await takeVerificationAttempt({ email: USER_EMAIL })).toBeNull();
  });
});
