import { db } from "@/server/db/connection";
import { grantQuizBonus } from "@/server/modules/billing/balance";
import {
  EmailNotVerifiedError,
  isUserEmailVerified,
} from "@/server/modules/billing/email-verification";
import { createQuizResponse } from "@/server/modules/quiz/queries/create-quiz-response";
import { getQuizDefinition } from "@/server/modules/quiz/registry";

export type SubmitQuizResult =
  /**
   * The answers are saved (now, or by an earlier call). `bonus` is what THIS
   * call credited, in minor units; null when nothing was credited now (the
   * bonus was paid before).
   */
  | {
      status: "completed";
      isBonusGranted: boolean;
      bonus: { amountMinor: number; currencyCode: string } | null;
    }
  | { status: "unknown_quiz" }
  /** The answers do not fit the quiz's own schema. */
  | { status: "invalid_answers" }
  /** The bonus is paid only to a confirmed email; nothing was saved. */
  | { status: "email_not_verified" };

/**
 * Saves a user's answers to a reward quiz and pays its bonus.
 *
 * The checks run in this order: the quiz exists, the answers fit its schema,
 * the email is verified (read from the database, not from a session).
 *
 * The answers row and the bonus are written in ONE transaction, so that
 * either both exist afterwards or neither. Written separately, a failed grant
 * would leave the answers saved and the user unpaid, and a retry that finds
 * the answers would never pay. Both writes are idempotent (one answers row
 * and one `quiz_bonus` transaction per user and quiz), so a repeat call
 * credits nothing, and a call for answers saved earlier without a bonus pays
 * it now. Concurrent calls pay once: the grant locks the balance row until
 * the transaction ends.
 *
 * Takes no request: the caller reads the user and the answers from its own
 * request. `answers` is untrusted input of any shape.
 */
export const submitQuiz = async ({
  userId,
  quizKey,
  answers,
}: {
  userId: string;
  quizKey: string;
  answers: unknown;
}): Promise<SubmitQuizResult> => {
  const definition = getQuizDefinition(quizKey);
  if (!definition) {
    return { status: "unknown_quiz" };
  }

  const parsedAnswers = definition.schema.safeParse(answers);
  if (!parsedAnswers.success) {
    return { status: "invalid_answers" };
  }

  if (!(await isUserEmailVerified(userId))) {
    return { status: "email_not_verified" };
  }

  try {
    return await db.transaction(async (tx) => {
      await createQuizResponse(
        { userId, quizKey, answers: parsedAnswers.data },
        tx
      );
      const grant = await grantQuizBonus(
        userId,
        quizKey,
        definition.bonusMajorUnits,
        tx
      );

      if (!grant) {
        return { status: "completed", isBonusGranted: false, bonus: null };
      }

      return {
        status: "completed",
        isBonusGranted: true,
        bonus: {
          amountMinor: grant.amount,
          currencyCode: grant.currencyCode,
        },
      };
    });
  } catch (error) {
    // The email was verified a moment ago, so this is a race at most; the
    // transaction was rolled back, so nothing was saved.
    if (error instanceof EmailNotVerifiedError) {
      return { status: "email_not_verified" };
    }
    throw error;
  }
};
