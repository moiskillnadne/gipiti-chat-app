import { oc } from "@orpc/contract";

import { callerAccess } from "@/server/api/_kit/caller-access";
import { unauthorizedError } from "@/server/api/_kit/common-errors";
import { meSchema } from "@/server/api/v1/_schemas/me";

export const meContract = {
  get: oc
    .errors(unauthorizedError)
    .route({
      method: "GET",
      path: "/me",
      spec: callerAccess("required"),
      summary: "The signed-in user and their balance",
      tags: ["me"],
    })
    .output(meSchema),
};
