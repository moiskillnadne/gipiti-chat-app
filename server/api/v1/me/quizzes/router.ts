import { requireAuth } from "@/server/api/_kit/middleware";
import { v1 } from "@/server/api/v1/implementer";
import { getQuizCompletion } from "@/server/modules/quiz/get-quiz-completion";
import { submitQuiz } from "@/server/modules/quiz/submit-quiz";

export const meQuizzesRouter = {
  get: v1.me.quizzes.get
    .use(requireAuth)
    .handler(async ({ input, context, errors }) => {
      const result = await getQuizCompletion({
        userId: context.principal.userId,
        quizKey: input.quizKey,
      });

      switch (result.status) {
        case "ok":
          return { completed: result.isCompleted };
        case "unknown_quiz":
          throw errors.NOT_FOUND();
        default: {
          const unhandled: never = result;
          throw new Error(`Unhandled result: ${JSON.stringify(unhandled)}`);
        }
      }
    }),

  submit: v1.me.quizzes.submit
    .use(requireAuth)
    .handler(async ({ input, context, errors }) => {
      const result = await submitQuiz({
        userId: context.principal.userId,
        quizKey: input.quizKey,
        answers: input.answers,
      });

      switch (result.status) {
        case "completed":
          return {
            completed: true,
            bonusGranted: result.isBonusGranted,
            bonus: result.bonus,
          };
        case "unknown_quiz":
          throw errors.NOT_FOUND();
        case "invalid_answers":
          // The quiz's own validation issues stay on the server.
          throw errors.BAD_REQUEST({ data: { reason: "invalid_answers" } });
        case "email_not_verified":
          throw errors.FORBIDDEN({ data: { reason: "email_not_verified" } });
        default: {
          const unhandled: never = result;
          throw new Error(`Unhandled result: ${JSON.stringify(unhandled)}`);
        }
      }
    }),
};
