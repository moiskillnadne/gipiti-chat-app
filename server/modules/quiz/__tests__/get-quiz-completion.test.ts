import { beforeEach, describe, expect, it, vi } from "vitest";

import type { QuizResponse } from "@/server/db/schema";
import { getQuizCompletion } from "@/server/modules/quiz/get-quiz-completion";
import { getQuizResponse } from "@/server/modules/quiz/queries/get-quiz-response";

vi.mock("server-only", () => ({}));
vi.mock("@/server/db/connection", () => ({ db: {} }));
vi.mock("@/server/modules/quiz/queries/get-quiz-response", () => ({
  getQuizResponse: vi.fn(),
}));

const USER_ID = "user-1";
const QUIZ_KEY = "onboarding";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getQuizCompletion", () => {
  it("reports a quiz with saved answers as completed", async () => {
    // Arrange
    vi.mocked(getQuizResponse).mockResolvedValue({
      id: "response-1",
    } as QuizResponse);

    // Act
    const result = await getQuizCompletion({
      userId: USER_ID,
      quizKey: QUIZ_KEY,
    });

    // Assert
    expect(result).toEqual({ status: "ok", isCompleted: true });
    expect(getQuizResponse).toHaveBeenCalledWith({
      userId: USER_ID,
      quizKey: QUIZ_KEY,
    });
  });

  it("reports a quiz without saved answers as not completed", async () => {
    // Arrange
    vi.mocked(getQuizResponse).mockResolvedValue(null);

    // Act
    const result = await getQuizCompletion({
      userId: USER_ID,
      quizKey: QUIZ_KEY,
    });

    // Assert
    expect(result).toEqual({ status: "ok", isCompleted: false });
  });

  it.each(["no-such-quiz", "constructor", "toString"])(
    "reports the unknown quiz key %s without reading the database",
    async (quizKey) => {
      // Act
      const result = await getQuizCompletion({
        userId: USER_ID,
        quizKey,
      });

      // Assert
      expect(result).toEqual({ status: "unknown_quiz" });
      expect(getQuizResponse).not.toHaveBeenCalled();
    }
  );
});
