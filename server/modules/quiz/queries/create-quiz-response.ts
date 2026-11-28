import { ChatSDKError } from "@/lib/errors";
import type { QuizAnswers } from "@/lib/quiz/types";
import { type DatabaseExecutor, db } from "@/server/db/connection";
import { type QuizResponse, quizResponse } from "@/server/db/schema";

// Persist a completed quiz response. Idempotent: a second submission for the
// same (userId, quizKey) is ignored (the unique index makes completion a single
// row), and the already-stored response is returned instead. Inside a
// transaction, pass it as `executor`: the row then exists only if that
// transaction commits.
export async function createQuizResponse(
  {
    userId,
    quizKey,
    answers,
  }: {
    userId: string;
    quizKey: string;
    answers: QuizAnswers;
  },
  executor: DatabaseExecutor = db
): Promise<QuizResponse> {
  try {
    const [inserted] = await executor
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
    const existing = await getQuizResponse({ userId, quizKey }, executor);

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
