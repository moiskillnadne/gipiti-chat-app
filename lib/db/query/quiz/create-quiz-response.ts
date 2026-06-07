import { ChatSDKError } from "../../../errors";
import type { QuizAnswers } from "../../../quiz/types";
import { db } from "../../connection";
import { type QuizResponse, quizResponse } from "../../schema";

// Persist a completed quiz response. Idempotent: a second submission for the
// same (userId, quizKey) is ignored (the unique index makes completion a single
// row), and the already-stored response is returned instead.
export async function createQuizResponse({
  userId,
  quizKey,
  answers,
}: {
  userId: string;
  quizKey: string;
  answers: QuizAnswers;
}): Promise<QuizResponse> {
  try {
    const [inserted] = await db
      .insert(quizResponse)
      .values({ userId, quizKey, answers })
      .onConflictDoNothing({
        target: [quizResponse.userId, quizResponse.quizKey],
      })
      .returning();

    if (inserted) {
      return inserted;
    }

    // Conflict — a response already exists; return the stored one.
    const { getQuizResponse } = await import("./get-quiz-response");
    const existing = await getQuizResponse({ userId, quizKey });

    if (!existing) {
      throw new ChatSDKError(
        "bad_request:database",
        "Failed to persist quiz response"
      );
    }

    return existing;
  } catch (error) {
    if (error instanceof ChatSDKError) {
      throw error;
    }
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to persist quiz response"
    );
  }
}
