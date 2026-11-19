import { oc } from "@orpc/contract";

import { configSchema } from "@/server/api/v1/_schemas/config";

export const configContract = {
  get: oc
    .route({
      method: "GET",
      path: "/config",
      summary: "Settings that are the same for every caller",
      tags: ["config"],
    })
    .output(configSchema),
};
