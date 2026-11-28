import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  isUserEmailVerified: vi.fn(),
  getQuizResponse: vi.fn(),
  createQuizResponse: vi.fn(),
  grantQuizBonus: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/modules/auth/next-auth", () => ({ auth: mocks.auth }));
vi.mock("@/server/db/connection", () => ({ db: {} }));
vi.mock("@/lib/billing/email-verification", () => ({
  isUserEmailVerified: mocks.isUserEmailVerified,
}));
vi.mock("@/lib/billing/balance", () => ({
  grantQuizBonus: mocks.grantQuizBonus,
}));
vi.mock("@/server/modules/quiz/queries/get-quiz-response", () => ({
  getQuizResponse: mocks.getQuizResponse,
}));
vi.mock("@/server/modules/quiz/queries/create-quiz-response", () => ({
  createQuizResponse: mocks.createQuizResponse,
}));

import { getTranslations } from "@/lib/i18n/translate";
import { ONBOARDING_QUIZ_KEY } from "@/lib/quiz/types";
import { POST } from "../route";

const USER_ID = "user-1";

const validAnswers = {
  sphere: "it",
  purpose: ["work"],
  create: ["text"],
  models: ["gpt"],
  level: 3,
  contacts: "@handle",
};

const submitQuiz = async (): Promise<Response> =>
  await POST(
    new Request(`http://localhost/api/quiz/${ONBOARDING_QUIZ_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers: validAnswers }),
    }),
    { params: Promise.resolve({ key: ONBOARDING_QUIZ_KEY }) }
  );

describe("POST /api/quiz/[key]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: USER_ID } });
    mocks.getQuizResponse.mockResolvedValue(null);
  });

  it("returns 403 to an unverified user and saves nothing", async () => {
    // Arrange
    mocks.isUserEmailVerified.mockResolvedValue(false);
    const t = await getTranslations("onboardingQuiz.api");

    // Act
    const response = await submitQuiz();

    // Assert
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      code: "forbidden:auth",
      message: t("emailNotVerified"),
    });
    expect(mocks.isUserEmailVerified).toHaveBeenCalledWith(USER_ID);
    expect(mocks.createQuizResponse).not.toHaveBeenCalled();
    expect(mocks.grantQuizBonus).not.toHaveBeenCalled();
  });

  it("saves the answers and grants the bonus to a verified user", async () => {
    // Arrange
    mocks.isUserEmailVerified.mockResolvedValue(true);

    // Act
    const response = await submitQuiz();

    // Assert
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ completed: true });
    expect(mocks.createQuizResponse).toHaveBeenCalledWith({
      userId: USER_ID,
      quizKey: ONBOARDING_QUIZ_KEY,
      answers: validAnswers,
    });
    expect(mocks.grantQuizBonus).toHaveBeenCalledWith(
      USER_ID,
      ONBOARDING_QUIZ_KEY,
      expect.any(Number)
    );
  });

  it("does not save or grant again when a verified user already completed the quiz", async () => {
    // Arrange
    mocks.isUserEmailVerified.mockResolvedValue(true);
    mocks.getQuizResponse.mockResolvedValue({ id: "response-1" });

    // Act
    const response = await submitQuiz();

    // Assert
    expect(response.status).toBe(200);
    expect(mocks.createQuizResponse).not.toHaveBeenCalled();
    expect(mocks.grantQuizBonus).not.toHaveBeenCalled();
  });
});
