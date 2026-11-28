import { getQuizResponse } from "@/server/modules/quiz/queries/get-quiz-response";
import { getQuizDefinition } from "@/server/modules/quiz/registry";

export type QuizCompletionResult =
  | { status: "ok"; isCompleted: boolean }
  | { status: "unknown_quiz" };

/**
 * Whether the user has already completed a quiz. An unknown key is reported
 * as such, not as "not completed": a client that mistyped a key must learn
 * it, while the legacy route keeps its own answer for that case.
 */
export const getQuizCompletion = async ({
  userId,
  quizKey,
}: {
  userId: string;
  quizKey: string;
}): Promise<QuizCompletionResult> => {
  if (!getQuizDefinition(quizKey)) {
    return { status: "unknown_quiz" };
  }

  const existing = await getQuizResponse({ userId, quizKey });

  return { status: "ok", isCompleted: existing !== null };
};
