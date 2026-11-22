import { oc } from "@orpc/contract";

import { serviceUnavailableError } from "@/server/api/_kit/common-errors";
import {
  changePasswordInputSchema,
  changePasswordOutputSchema,
  forgotPasswordInputSchema,
  resetPasswordInputSchema,
} from "@/server/api/v1/_schemas/auth";
import {
  badRequestWithReason,
  forbiddenWithReason,
  tooManyRequestsWithRetry,
  unauthorizedWithReason,
} from "@/server/api/v1/_schemas/auth-errors";

const AUTH_TAGS = ["auth"];

export const passwordContract = {
  forgot: oc
    .errors({ ...tooManyRequestsWithRetry, ...serviceUnavailableError })
    .route({
      method: "POST",
      path: "/auth/password/forgot",
      successStatus: 202,
      summary: "Email a password-reset link",
      description:
        "Always answers 202, whether or not an account has this email, so the answer does not reveal which addresses are registered. The link opens the website's reset page and is good for one hour. No credentials are needed. 429 after five requests for one address within an hour.",
      tags: AUTH_TAGS,
    })
    .input(forgotPasswordInputSchema),

  reset: oc
    .errors(badRequestWithReason)
    .route({
      method: "POST",
      path: "/auth/password/reset",
      successStatus: 204,
      summary: "Set a new password with a reset token",
      description:
        "The token from the emailed link is the credential. On success every session of the account ends, on every device: sign in again with the new password. 400 `invalid_token` when the token is unknown, used or older than an hour; 400 `weak_password`.",
      tags: AUTH_TAGS,
    })
    .input(resetPasswordInputSchema),

  change: oc
    .errors({
      ...unauthorizedWithReason,
      ...forbiddenWithReason,
      ...badRequestWithReason,
      ...tooManyRequestsWithRetry,
      ...serviceUnavailableError,
    })
    .route({
      method: "POST",
      path: "/auth/password/change",
      summary: "Change the password of the signed-in account",
      description: [
        "Needs an access token or a browser session, and the current password. Every other session of the account ends. The caller stays signed in: with an access token the answer carries a new pair (the old tokens stop working at once), a browser gets a fresh cookie.",
        "",
        "401 `invalid_credentials` when the current password is wrong; wrong guesses count against the same limits as signing in (429, 503). 400 `weak_password`.",
      ].join("\n"),
      tags: AUTH_TAGS,
    })
    .input(changePasswordInputSchema)
    .output(changePasswordOutputSchema),
};
