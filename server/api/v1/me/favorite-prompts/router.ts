import { requireAuth } from "@/server/api/_kit/middleware";
import { v1 } from "@/server/api/v1/implementer";
import { addPromptFavorite } from "@/server/modules/prompts/queries/add-prompt-favorite";
import { getActiveFavoritePromptIds } from "@/server/modules/prompts/queries/get-active-favorite-prompt-ids";
import { isActivePrompt } from "@/server/modules/prompts/queries/is-active-prompt";
import { removePromptFavorite } from "@/server/modules/prompts/queries/remove-prompt-favorite";

export const meFavoritePromptsRouter = {
  list: v1.me.favoritePrompts.list
    .use(requireAuth)
    .handler(async ({ context }) => {
      const promptIds = await getActiveFavoritePromptIds({
        userId: context.principal.userId,
      });

      return { items: promptIds.map((promptId) => ({ promptId })) };
    }),

  add: v1.me.favoritePrompts.add
    .use(requireAuth)
    .handler(async ({ input, context, errors }) => {
      // A favourite always refers to a prompt `GET /prompts` offers. Checked
      // first as well: a missing prompt would end in a foreign-key violation,
      // which is a 500, not an answer.
      if (!(await isActivePrompt({ promptId: input.promptId }))) {
        throw errors.NOT_FOUND();
      }

      await addPromptFavorite({
        userId: context.principal.userId,
        promptId: input.promptId,
      });
    }),

  remove: v1.me.favoritePrompts.remove
    .use(requireAuth)
    .handler(async ({ input, context }) => {
      await removePromptFavorite({
        userId: context.principal.userId,
        promptId: input.promptId,
      });
    }),
};
