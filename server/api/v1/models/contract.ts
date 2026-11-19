import { oc } from "@orpc/contract";

import { modelListSchema } from "@/server/api/v1/_schemas/model";

export const modelsContract = {
  list: oc
    .route({
      method: "GET",
      path: "/models",
      summary: "Models a user can pick in the chat",
      tags: ["models"],
    })
    .output(modelListSchema),
};
