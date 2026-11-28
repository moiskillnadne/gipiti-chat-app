import { oc } from "@orpc/contract";

import { callerAccess } from "@/server/api/_kit/caller-access";
import { modelListSchema } from "@/server/api/v1/_schemas/model";

export const modelsContract = {
  list: oc
    .route({
      method: "GET",
      path: "/models",
      spec: callerAccess("none"),
      summary: "Models a user can pick in the chat",
      tags: ["models"],
    })
    .output(modelListSchema),
};
