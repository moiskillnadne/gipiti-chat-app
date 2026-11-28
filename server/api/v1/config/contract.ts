import { oc } from "@orpc/contract";

import { callerAccess } from "@/server/api/_kit/caller-access";
import { configSchema } from "@/server/api/v1/_schemas/config";

export const configContract = {
  get: oc
    .route({
      method: "GET",
      path: "/config",
      spec: callerAccess("none"),
      summary: "Settings that are the same for every caller",
      tags: ["config"],
    })
    .output(configSchema),
};
