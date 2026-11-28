import { oc } from "@orpc/contract";

import { callerAccess } from "@/server/api/_kit/caller-access";
import { unauthorizedError } from "@/server/api/_kit/common-errors";
import { meSubscriptionSchema } from "@/server/api/v1/_schemas/billing";

export const meSubscriptionContract = {
  get: oc
    .errors(unauthorizedError)
    .route({
      method: "GET",
      path: "/me/subscription",
      spec: callerAccess("required"),
      summary: "The user's subscription",
      description:
        "The latest subscription of the caller: plan, status, period, price, next payment and the stored card's mask. `subscription` is null for an account that never subscribed. A subscription that has ended or expired is still returned, with `state: none`. Needs an access token or a browser session.",
      tags: ["me", "subscription"],
    })
    .output(meSubscriptionSchema),
};
