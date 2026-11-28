import { oc } from "@orpc/contract";

import { callerAccess } from "@/server/api/_kit/caller-access";
import {
  notFoundError,
  unauthorizedError,
} from "@/server/api/_kit/common-errors";
import {
  quizCompletionSchema,
  quizKeyInputSchema,
  submitQuizInputSchema,
  submitQuizOutputSchema,
} from "@/server/api/v1/_schemas/quiz";
import {
  quizBadRequestWithReason,
  quizForbiddenWithReason,
} from "@/server/api/v1/_schemas/quiz-errors";

const QUIZ_TAGS = ["me", "quizzes"];

export const meQuizzesContract = {
  get: oc
    .errors({ ...unauthorizedError, ...notFoundError })
    .route({
      method: "GET",
      path: "/me/quizzes/{quizKey}",
      spec: callerAccess("required"),
      summary: "Has the user completed a quiz",
      description:
        "Needs an access token or a browser session. 404 when there is no quiz with this key.",
      tags: QUIZ_TAGS,
    })
    .input(quizKeyInputSchema)
    .output(quizCompletionSchema),

  submit: oc
    .errors({
      ...unauthorizedError,
      ...quizForbiddenWithReason,
      ...notFoundError,
      ...quizBadRequestWithReason,
    })
    .route({
      method: "PUT",
      path: "/me/quizzes/{quizKey}",
      spec: callerAccess("required"),
      summary: "Save the answers to a quiz and receive its bonus",
      description: [
        "Saves the answers and credits the quiz's bonus to the top-up balance, in one step: either both happen or neither. Needs an access token or a browser session. Safe to repeat: a second call saves nothing new, credits nothing (`bonusGranted: false`, `bonus: null`) and still answers `completed: true`. If the earlier answers were saved without the bonus, this call pays it.",
        "",
        "`bonus` is what THIS call credited. The checks run in this order: 404 when there is no quiz with this key; 400 `invalid_answers` when the answers do not fit the quiz (the shape is the quiz's own); 403 `email_not_verified` when the account's email is not confirmed (nothing is saved, take the quiz after confirming; see `POST /auth/email-verification/verify`).",
      ].join("\n"),
      tags: QUIZ_TAGS,
    })
    .input(submitQuizInputSchema)
    .output(submitQuizOutputSchema),
};
