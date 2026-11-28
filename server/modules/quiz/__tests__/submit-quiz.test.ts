import { beforeEach, describe, expect, it, vi } from "vitest";

import { grantQuizBonus } from "@/lib/billing/balance";
import {
  EmailNotVerifiedError,
  isUserEmailVerified,
} from "@/lib/billing/email-verification";
import { db } from "@/server/db/connection";
import { createQuizResponse } from "@/server/modules/quiz/queries/create-quiz-response";
import { submitQuiz } from "@/server/modules/quiz/submit-quiz";

vi.mock("server-only", () => ({}));

const transactionHandle = vi.hoisted(() => ({ name: "transaction" }));

vi.mock("@/server/db/connection", () => ({
  db: {
    transaction: vi.fn(async (work: (tx: unknown) => Promise<unknown>) =>
      work(transactionHandle)
    ),
  },
}));
vi.mock("@/lib/billing/balance", () => ({
  grantQuizBonus: vi.fn(),
}));
vi.mock("@/lib/billing/email-verification", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/billing/email-verification")
  >("@/lib/billing/email-verification");

  return { ...actual, isUserEmailVerified: vi.fn() };
});
vi.mock("@/server/modules/quiz/queries/create-quiz-response", () => ({
  createQuizResponse: vi.fn(),
}));

const USER_ID = "user-1";
const QUIZ_KEY = "onboarding";
const GRANT = {
  amount: 5000,
  currencyCode: "RUB",
  subscriptionBalanceAfter: 0,
  topupBalanceAfter: 5000,
  transactionId: "transaction-1",
};
const VALID_ANSWERS = {
  sphere: "it",
  purpose: ["work"],
  create: ["text"],
  models: ["gpt"],
  level: 3,
  contacts: "  @handle  ",
};

const submit = (answers: unknown, quizKey = QUIZ_KEY) =>
  submitQuiz({ userId: USER_ID, quizKey, answers });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isUserEmailVerified).mockResolvedValue(true);
  vi.mocked(grantQuizBonus).mockResolvedValue(GRANT);
});

describe("submitQuiz", () => {
  it("saves the answers and the bonus in one transaction and reports the bonus", async () => {
    // Act
    const result = await submit(VALID_ANSWERS);

    // Assert
    expect(result).toEqual({
      status: "completed",
      isBonusGranted: true,
      bonus: { amountMinor: 5000, currencyCode: "RUB" },
    });
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(createQuizResponse).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_ID, quizKey: QUIZ_KEY }),
      transactionHandle
    );
    expect(grantQuizBonus).toHaveBeenCalledWith(
      USER_ID,
      QUIZ_KEY,
      expect.any(Number),
      transactionHandle
    );
  });

  it("saves the answers as the quiz's schema parsed them", async () => {
    // Act
    await submit(VALID_ANSWERS);

    // Assert
    expect(createQuizResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        answers: expect.objectContaining({ contacts: "@handle" }),
      }),
      transactionHandle
    );
  });

  it("reports no bonus when the grant was paid before", async () => {
    // Arrange
    vi.mocked(grantQuizBonus).mockResolvedValue(null);

    // Act
    const result = await submit(VALID_ANSWERS);

    // Assert
    expect(result).toEqual({
      status: "completed",
      isBonusGranted: false,
      bonus: null,
    });
  });

  it("reports an unknown quiz and writes nothing", async () => {
    // Act
    const result = await submit(VALID_ANSWERS, "no-such-quiz");

    // Assert
    expect(result).toEqual({ status: "unknown_quiz" });
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it.each(["constructor", "toString", "__proto__"])(
    "reports the key %s, a name on Object.prototype, as an unknown quiz",
    async (quizKey) => {
      // Act
      const result = await submit(VALID_ANSWERS, quizKey);

      // Assert
      expect(result).toEqual({ status: "unknown_quiz" });
      expect(db.transaction).not.toHaveBeenCalled();
    }
  );

  it("reports invalid answers before it looks at the email", async () => {
    // Arrange
    vi.mocked(isUserEmailVerified).mockResolvedValue(false);

    // Act
    const result = await submit({ sphere: "nonsense" });

    // Assert
    expect(result).toEqual({ status: "invalid_answers" });
    expect(isUserEmailVerified).not.toHaveBeenCalled();
  });

  it.each([undefined, null, "text", 5, ["a"]])(
    "reports %j as invalid answers",
    async (answers) => {
      // Act
      const result = await submit(answers);

      // Assert
      expect(result).toEqual({ status: "invalid_answers" });
      expect(db.transaction).not.toHaveBeenCalled();
    }
  );

  it("refuses an unverified email and writes nothing", async () => {
    // Arrange
    vi.mocked(isUserEmailVerified).mockResolvedValue(false);

    // Act
    const result = await submit(VALID_ANSWERS);

    // Assert
    expect(result).toEqual({ status: "email_not_verified" });
    expect(db.transaction).not.toHaveBeenCalled();
    expect(createQuizResponse).not.toHaveBeenCalled();
    expect(grantQuizBonus).not.toHaveBeenCalled();
  });

  it("refuses an email that stopped being verified during the transaction", async () => {
    // Arrange
    vi.mocked(grantQuizBonus).mockRejectedValue(
      new EmailNotVerifiedError(USER_ID)
    );

    // Act
    const result = await submit(VALID_ANSWERS);

    // Assert
    expect(result).toEqual({ status: "email_not_verified" });
  });

  it("passes a failure of the grant on, so the transaction rolls back", async () => {
    // Arrange
    vi.mocked(grantQuizBonus).mockRejectedValue(new Error("grant failed"));

    // Act
    const result = submit(VALID_ANSWERS);

    // Assert
    await expect(result).rejects.toThrow("grant failed");
  });
});
