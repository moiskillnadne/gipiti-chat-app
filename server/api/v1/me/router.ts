import { requireAuth } from "@/server/api/_kit/middleware";
import { v1 } from "@/server/api/v1/implementer";
import { meBillingRouter } from "@/server/api/v1/me/billing/router";
import { meFavoritePromptsRouter } from "@/server/api/v1/me/favorite-prompts/router";
import { loadMe } from "@/server/api/v1/me/load-me";
import { meQuizzesRouter } from "@/server/api/v1/me/quizzes/router";
import { meSubscriptionRouter } from "@/server/api/v1/me/subscription/router";

export const meRouter = {
  get: v1.me.get.use(requireAuth).handler(async ({ context, errors }) => {
    const me = await loadMe(context.principal.userId);

    // The account behind the session is gone.
    if (!me) {
      throw errors.UNAUTHORIZED();
    }

    return me;
  }),

  favoritePrompts: meFavoritePromptsRouter,
  quizzes: meQuizzesRouter,
  billing: meBillingRouter,
  subscription: meSubscriptionRouter,
};
