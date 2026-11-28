import { oc } from "@orpc/contract";

import { callerAccess } from "@/server/api/_kit/caller-access";
import {
  forbiddenError,
  notFoundError,
  unauthorizedError,
} from "@/server/api/_kit/common-errors";
import {
  authSessionIdInputSchema,
  authSessionListSchema,
} from "@/server/api/v1/_schemas/auth";

const AUTH_TAGS = ["auth"];

export const authSessionsContract = {
  list: oc
    .errors(unauthorizedError)
    .route({
      method: "GET",
      path: "/auth/sessions",
      spec: callerAccess("required"),
      summary: "The apps signed in to this account",
      description:
        "Sessions of API clients that can still be used, most recently used first. Browser sessions are not listed: they have no entry of their own and end only all together, through `POST /auth/logout-all` or a password change. Needs an access token or a browser session.",
      tags: AUTH_TAGS,
    })
    .output(authSessionListSchema),

  revoke: oc
    .errors({ ...unauthorizedError, ...forbiddenError, ...notFoundError })
    .route({
      method: "DELETE",
      path: "/auth/sessions/{sessionId}",
      spec: callerAccess("required"),
      successStatus: 204,
      summary: "Sign one app out",
      description:
        "Ends one session from the list. 404 when the account has no live session with this id, which is also the answer for a session of another account.",
      tags: AUTH_TAGS,
    })
    .input(authSessionIdInputSchema),
};
