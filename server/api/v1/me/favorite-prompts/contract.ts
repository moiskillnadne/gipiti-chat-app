import { oc } from "@orpc/contract";

import { callerAccess } from "@/server/api/_kit/caller-access";
import {
  forbiddenError,
  notFoundError,
  unauthorizedError,
} from "@/server/api/_kit/common-errors";
import {
  favoritePromptListSchema,
  promptIdInputSchema,
} from "@/server/api/v1/_schemas/prompt";

const FAVORITE_PROMPTS_TAGS = ["me", "prompts"];

export const meFavoritePromptsContract = {
  list: oc
    .errors(unauthorizedError)
    .route({
      method: "GET",
      path: "/me/favorite-prompts",
      spec: callerAccess("required"),
      summary: "The prompts the user has starred",
      description:
        "The ids of the caller's favourite prompts, as one list. Needs an access token or a browser session. Only prompts that `GET /prompts` offers now are listed: a favourite of a prompt that has been switched off stays stored, is left out here, and reappears if the prompt is switched on again.",
      tags: FAVORITE_PROMPTS_TAGS,
    })
    .output(favoritePromptListSchema),

  add: oc
    .errors({ ...unauthorizedError, ...forbiddenError, ...notFoundError })
    .route({
      method: "PUT",
      path: "/me/favorite-prompts/{promptId}",
      spec: callerAccess("required"),
      successStatus: 204,
      summary: "Star a prompt",
      description:
        "Safe to repeat: a prompt that is already a favourite answers 204 as well. 404 when no such prompt is on offer: no prompt has this id, or it is switched off (not in `GET /prompts`).",
      tags: FAVORITE_PROMPTS_TAGS,
    })
    .input(promptIdInputSchema),

  remove: oc
    .errors({ ...unauthorizedError, ...forbiddenError })
    .route({
      method: "DELETE",
      path: "/me/favorite-prompts/{promptId}",
      spec: callerAccess("required"),
      successStatus: 204,
      summary: "Unstar a prompt",
      description:
        "Safe to repeat: a prompt that is not a favourite answers 204 as well, whatever the prompt's state: a favourite of a switched-off prompt is removed too, and an unknown id is not an error.",
      tags: FAVORITE_PROMPTS_TAGS,
    })
    .input(promptIdInputSchema),
};
