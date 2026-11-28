import { oc } from "@orpc/contract";

import { callerAccess } from "@/server/api/_kit/caller-access";
import { unauthorizedError } from "@/server/api/_kit/common-errors";
import { planListSchema } from "@/server/api/v1/_schemas/plan";

export const plansContract = {
  list: oc
    .errors(unauthorizedError)
    .route({
      method: "GET",
      path: "/plans",
      spec: callerAccess("optional"),
      summary: "Subscription plans on sale",
      description:
        "Works without authentication. A signed-in internal tester also sees the tester-only plans.",
      tags: ["plans"],
    })
    .output(planListSchema),
};
