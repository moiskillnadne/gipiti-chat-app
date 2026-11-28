import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  submitQuiz: vi.fn(),
  getQuizResponse: vi.fn(),
  recordLegacyHit: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/modules/auth/next-auth", () => ({ auth: mocks.auth }));
vi.mock("@/server/db/connection", () => ({ db: {} }));
vi.mock("@/server/http/legacy-hit", () => ({
  recordLegacyHit: mocks.recordLegacyHit,
}));
vi.mock("@/server/modules/quiz/queries/get-quiz-response", () => ({
  getQuizResponse: mocks.getQuizResponse,
}));
vi.mock("@/server/modules/quiz/submit-quiz", () => ({
  submitQuiz: mocks.submitQuiz,
}));

import { getTranslations } from "@/lib/i18n/translate";
import { ONBOARDING_QUIZ_KEY } from "@/lib/quiz/types";
import { GET, POST } from "../route";

const USER_ID = "user-1";

const validAnswers = {
  sphere: "it",
  purpose: ["work"],
  create: ["text"],
  models: ["gpt"],
  level: 3,
  contacts: "@handle",
};

const postQuiz = async (
  body: string = JSON.stringify({ answers: validAnswers }),
  key: string = ONBOARDING_QUIZ_KEY
): Promise<Response> =>
  await POST(
    new Request(`http://localhost/api/quiz/${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    }),
    { params: Promise.resolve({ key }) }
  );

describe("POST /api/quiz/[key]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: USER_ID } });
    mocks.submitQuiz.mockResolvedValue({
      status: "completed",
      isBonusGranted: true,
      bonus: { amountMinor: 5000, currencyCode: "RUB" },
    });
  });

  const getQuiz = async (): Promise<Response> =>
    await GET(new Request("http://localhost/api/quiz/onboarding"), {
      params: Promise.resolve({ key: ONBOARDING_QUIZ_KEY }),
    });

  it("counts a signed-in POST as one legacy hit", async () => {
    // Act
    await postQuiz();

    // Assert
    expect(mocks.recordLegacyHit).toHaveBeenCalledExactlyOnceWith(
      "POST /api/quiz/[key]"
    );
  });

  it("does not count a signed-out POST", async () => {
    // Arrange
    mocks.auth.mockResolvedValue(null);

    // Act
    await postQuiz();

    // Assert
    expect(mocks.recordLegacyHit).not.toHaveBeenCalled();
  });

  it("counts a signed-in GET as one legacy hit", async () => {
    // Arrange
    mocks.getQuizResponse.mockResolvedValue(null);

    // Act
    await getQuiz();

    // Assert
    expect(mocks.recordLegacyHit).toHaveBeenCalledExactlyOnceWith(
      "GET /api/quiz/[key]"
    );
  });

  it("does not count a signed-out GET", async () => {
    // Arrange
    mocks.auth.mockResolvedValue(null);

    // Act
    await getQuiz();

    // Assert
    expect(mocks.recordLegacyHit).not.toHaveBeenCalled();
  });

  it("returns 401 to a signed-out visitor and submits nothing", async () => {
    // Arrange
    mocks.auth.mockResolvedValue(null);

    // Act
    const response = await postQuiz();

    // Assert
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "unauthorized:chat" });
    expect(mocks.submitQuiz).not.toHaveBeenCalled();
  });

  it("returns the localized 403 to an unverified user", async () => {
    // Arrange
    mocks.submitQuiz.mockResolvedValue({ status: "email_not_verified" });
    const t = await getTranslations("onboardingQuiz.api");

    // Act
    const response = await postQuiz();

    // Assert
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      code: "forbidden:auth",
      message: t("emailNotVerified"),
    });
  });

  it("hands the user, the quiz and the answers to the service and answers completed", async () => {
    // Act
    const response = await postQuiz();

    // Assert
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ completed: true });
    expect(mocks.submitQuiz).toHaveBeenCalledExactlyOnceWith({
      userId: USER_ID,
      quizKey: ONBOARDING_QUIZ_KEY,
      answers: validAnswers,
    });
  });

  it("answers completed, and shows no bonus, when the quiz was completed before", async () => {
    // Arrange
    mocks.submitQuiz.mockResolvedValue({
      status: "completed",
      isBonusGranted: false,
      bonus: null,
    });

    // Act
    const response = await postQuiz();

    // Assert
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ completed: true });
  });

  it("returns 400 for an unknown quiz and names the key", async () => {
    // Arrange
    mocks.submitQuiz.mockResolvedValue({ status: "unknown_quiz" });

    // Act
    const response = await postQuiz(undefined, "no-such-quiz");

    // Assert
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      code: "bad_request:api",
      cause: 'Unknown quiz "no-such-quiz"',
    });
  });

  it("returns 400 for answers the quiz refuses", async () => {
    // Arrange
    mocks.submitQuiz.mockResolvedValue({ status: "invalid_answers" });

    // Act
    const response = await postQuiz();

    // Assert
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      code: "bad_request:api",
      cause: "Invalid quiz answers",
    });
  });

  it("passes a body that is not JSON on as missing answers", async () => {
    // Act
    await postQuiz("not json");

    // Assert
    expect(mocks.submitQuiz).toHaveBeenCalledExactlyOnceWith({
      userId: USER_ID,
      quizKey: ONBOARDING_QUIZ_KEY,
      answers: undefined,
    });
  });
});
