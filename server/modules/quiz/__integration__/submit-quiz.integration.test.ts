import { eq, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { ONBOARDING_QUIZ_BONUS_MAJOR_UNITS } from "@/lib/billing/constants";
import { ONBOARDING_QUIZ_KEY } from "@/lib/quiz/types";
import { db } from "@/server/db/connection";
import { quizResponse, user } from "@/server/db/schema";
import { submitQuiz } from "@/server/modules/quiz/submit-quiz";
import {
  closeDatabaseConnection,
  readBalance,
  readTransactions,
  resetMoneyTables,
  seedCurrency,
  seedUserWithBalance,
  TEST_CURRENCY_CODE,
} from "@/tests/integration/helpers";

/** `seedCurrency` stores the test currency with two minor-unit digits. */
const BONUS_MINOR = ONBOARDING_QUIZ_BONUS_MAJOR_UNITS * 100;
const PARALLEL_SUBMITS = 4;
const REFUSE_BONUS_TRIGGER = "refuse_quiz_bonus_for_test";

const ANSWERS = {
  sphere: "it",
  purpose: ["work"],
  create: ["text"],
  models: ["gpt"],
  level: 3,
  contacts: "@handle",
};

const submit = (userId: string) =>
  submitQuiz({ userId, quizKey: ONBOARDING_QUIZ_KEY, answers: ANSWERS });

const seedUser = async (isVerified: boolean): Promise<string> => {
  const userId = await seedUserWithBalance();
  await db
    .update(user)
    .set({ emailVerified: isVerified })
    .where(eq(user.id, userId));

  return userId;
};

const readAnswerRows = async (userId: string) =>
  await db.select().from(quizResponse).where(eq(quizResponse.userId, userId));

const readQuizBonuses = async (userId: string) =>
  (await readTransactions(userId)).filter(
    (entry) => entry.type === "quiz_bonus"
  );

const saveAnswersWithoutBonus = async (userId: string): Promise<void> => {
  await db
    .insert(quizResponse)
    .values({ userId, quizKey: ONBOARDING_QUIZ_KEY, answers: ANSWERS });
};

/**
 * Makes Postgres itself refuse the bonus row, so the grant fails for real,
 * after the answers were written in the same transaction. No module is
 * replaced: the failure is the database's, as a full disk or a lost
 * connection would be.
 */
const refuseQuizBonuses = async (): Promise<void> => {
  await db.execute(
    sql.raw(`
    CREATE OR REPLACE FUNCTION ${REFUSE_BONUS_TRIGGER}() RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION 'quiz bonus refused by the test';
    END;
    $$ LANGUAGE plpgsql
  `)
  );
  await db.execute(
    sql.raw(`
    CREATE TRIGGER ${REFUSE_BONUS_TRIGGER}
    BEFORE INSERT ON "Transaction"
    FOR EACH ROW WHEN (NEW.type = 'quiz_bonus')
    EXECUTE FUNCTION ${REFUSE_BONUS_TRIGGER}()
  `)
  );
};

const allowQuizBonuses = async (): Promise<void> => {
  await db.execute(
    sql.raw(`DROP TRIGGER IF EXISTS ${REFUSE_BONUS_TRIGGER} ON "Transaction"`)
  );
  await db.execute(
    sql.raw(`DROP FUNCTION IF EXISTS ${REFUSE_BONUS_TRIGGER}()`)
  );
};

describe("submitQuiz against a real database", () => {
  beforeEach(async () => {
    await allowQuizBonuses();
    await resetMoneyTables();
    await seedCurrency();
  });

  afterEach(async () => {
    await allowQuizBonuses();
  });

  afterAll(async () => {
    await closeDatabaseConnection();
  });

  it("saves the answers, writes one quiz_bonus transaction and raises the top-up pool", async () => {
    // Arrange
    const userId = await seedUser(true);

    // Act
    const result = await submit(userId);

    // Assert
    expect(result).toEqual({
      status: "completed",
      isBonusGranted: true,
      bonus: { amountMinor: BONUS_MINOR, currencyCode: TEST_CURRENCY_CODE },
    });
    expect(await readAnswerRows(userId)).toHaveLength(1);
    expect(await readQuizBonuses(userId)).toMatchObject([
      {
        pool: "topup",
        amount: BONUS_MINOR,
        referenceId: ONBOARDING_QUIZ_KEY,
        topupBalanceAfter: BONUS_MINOR,
      },
    ]);
    expect((await readBalance(userId)).topupAmount).toBe(BONUS_MINOR);
  });

  it("writes nothing and reports no bonus on a second submit", async () => {
    // Arrange
    const userId = await seedUser(true);
    await submit(userId);

    // Act
    const second = await submit(userId);

    // Assert
    expect(second).toEqual({
      status: "completed",
      isBonusGranted: false,
      bonus: null,
    });
    expect(await readAnswerRows(userId)).toHaveLength(1);
    expect(await readQuizBonuses(userId)).toHaveLength(1);
    expect((await readBalance(userId)).topupAmount).toBe(BONUS_MINOR);
  });

  it("leaves no answers when the grant fails, and the next submit pays once", async () => {
    // Arrange
    const userId = await seedUser(true);
    await refuseQuizBonuses();

    // Act
    const failedSubmit = submit(userId);

    // Assert: the answers were written first, and rolled back with the grant
    await expect(failedSubmit).rejects.toThrow();
    expect(await readAnswerRows(userId)).toEqual([]);
    expect(await readQuizBonuses(userId)).toEqual([]);
    expect((await readBalance(userId)).topupAmount).toBe(0);

    // Act: the failure is over
    await allowQuizBonuses();
    const retry = await submit(userId);
    const repeat = await submit(userId);

    // Assert
    expect(retry).toMatchObject({ status: "completed", isBonusGranted: true });
    expect(repeat).toMatchObject({ isBonusGranted: false, bonus: null });
    expect(await readAnswerRows(userId)).toHaveLength(1);
    expect(await readQuizBonuses(userId)).toHaveLength(1);
    expect((await readBalance(userId)).topupAmount).toBe(BONUS_MINOR);
  });

  it("pays once when several submits run at the same time", async () => {
    // Arrange
    const userId = await seedUser(true);

    // Act
    const results = await Promise.all(
      Array.from({ length: PARALLEL_SUBMITS }, () => submit(userId))
    );

    // Assert
    expect(results.every(({ status }) => status === "completed")).toBe(true);
    expect(
      results.filter(
        (result) => "isBonusGranted" in result && result.isBonusGranted
      )
    ).toHaveLength(1);
    expect(await readAnswerRows(userId)).toHaveLength(1);
    expect(await readQuizBonuses(userId)).toHaveLength(1);
    expect((await readBalance(userId)).topupAmount).toBe(BONUS_MINOR);
  });

  it("refuses an unverified user and writes nothing", async () => {
    // Arrange
    const userId = await seedUser(false);

    // Act
    const result = await submit(userId);

    // Assert
    expect(result).toEqual({ status: "email_not_verified" });
    expect(await readAnswerRows(userId)).toEqual([]);
    expect(await readTransactions(userId)).toEqual([]);
    expect((await readBalance(userId)).topupAmount).toBe(0);
  });

  it("pays, once, a user whose answers an earlier version saved without a bonus", async () => {
    // Arrange: the state the old two-step code left behind after a failed grant
    const userId = await seedUser(true);
    await saveAnswersWithoutBonus(userId);

    // Act
    const first = await submit(userId);
    const second = await submit(userId);

    // Assert
    expect(first).toEqual({
      status: "completed",
      isBonusGranted: true,
      bonus: { amountMinor: BONUS_MINOR, currencyCode: TEST_CURRENCY_CODE },
    });
    expect(second).toMatchObject({ isBonusGranted: false, bonus: null });
    expect(await readAnswerRows(userId)).toHaveLength(1);
    expect(await readQuizBonuses(userId)).toHaveLength(1);
    expect((await readBalance(userId)).topupAmount).toBe(BONUS_MINOR);
  });
});
