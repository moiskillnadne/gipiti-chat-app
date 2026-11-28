import { oc } from "@orpc/contract";

import { callerAccess } from "@/server/api/_kit/caller-access";
import { promptListSchema } from "@/server/api/v1/_schemas/prompt";

export const promptsContract = {
  list: oc
    .route({
      method: "GET",
      path: "/prompts",
      spec: callerAccess("none"),
      summary: "The prompt library",
      description:
        "Every active prompt of the curated catalogue, in catalogue order, as one list (the catalogue is small, so there is no paging). The same for everyone: no credentials are read, so a client with a stale token can still fetch it. Which prompts a user has starred is `GET /me/favorite-prompts`.",
      tags: ["prompts"],
    })
    .output(promptListSchema),
};
