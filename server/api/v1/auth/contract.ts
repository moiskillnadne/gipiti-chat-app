import { oc } from "@orpc/contract";

import {
  forbiddenError,
  serviceUnavailableError,
  tooManyRequestsError,
} from "@/server/api/_kit/common-errors";
import {
  loginInputSchema,
  loginOutputSchema,
  refreshInputSchema,
  refreshOutputSchema,
  unauthorizedReasonDataSchema,
} from "@/server/api/v1/_schemas/auth";
import { authSessionsContract } from "@/server/api/v1/auth/sessions/contract";

const AUTH_TAGS = ["auth"];

/** A 401 of the auth endpoints always says why, in `data.reason`. */
const unauthorizedWithReason = {
  UNAUTHORIZED: {
    status: 401,
    message: "Authentication failed.",
    data: unauthorizedReasonDataSchema,
  },
} as const;

export const authContract = {
  login: oc
    .errors({
      ...unauthorizedWithReason,
      ...tooManyRequestsError,
      ...serviceUnavailableError,
    })
    .route({
      method: "POST",
      path: "/auth/login",
      summary: "Sign in with email and password",
      description: [
        "For clients that are not the website: opens a session and answers with an access token and a refresh token. No credentials are needed to call it.",
        "",
        "401 `invalid_credentials` for a wrong password and for an unknown email alike. 429 when there were too many attempts for this account or from this address; 503 when that limit cannot be checked, in which case retry after a moment.",
      ].join("\n"),
      tags: AUTH_TAGS,
    })
    .input(loginInputSchema)
    .output(loginOutputSchema),

  refresh: oc
    .errors(unauthorizedWithReason)
    .route({
      method: "POST",
      path: "/auth/refresh",
      summary: "Trade a refresh token for a new pair",
      description: [
        "The refresh token in the body is the credential; no `Authorization` header is needed. It works once: the answer carries the next refresh token.",
        "",
        "Make one refresh at a time and share its result. A second request with the same token within 30 seconds still gets a pair (the answer to the first may have been lost), at most twice. Later than that the token counts as copied, the session is revoked and the user has to sign in again.",
        "",
        "401 reasons: `refresh_invalid` (not a refresh token of ours, or retried too often), `refresh_expired` (unused for 60 days, or the session is 180 days old), `session_revoked` (logout, password change), `refresh_reused` (see above).",
      ].join("\n"),
      tags: AUTH_TAGS,
    })
    .input(refreshInputSchema)
    .output(refreshOutputSchema),

  logout: oc.errors(unauthorizedWithReason).route({
    method: "POST",
    path: "/auth/logout",
    successStatus: 204,
    summary: "End the session of this access token",
    description:
      "Needs an access token (401 `bearer_required` for a browser session: the website signs out through its own sign-out). The access token and the session's refresh tokens stop working at once. Safe to repeat.",
    tags: AUTH_TAGS,
  }),

  logoutAll: oc.errors({ ...unauthorizedWithReason, ...forbiddenError }).route({
    method: "POST",
    path: "/auth/logout-all",
    successStatus: 204,
    summary: "Sign out everywhere",
    description:
      "Ends every session of the account: every app and every browser, the caller's own included. Needs an access token or a browser session.",
    tags: AUTH_TAGS,
  }),

  sessions: authSessionsContract,
};
