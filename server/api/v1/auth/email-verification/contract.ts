import { oc } from "@orpc/contract";

import { serviceUnavailableError } from "@/server/api/_kit/common-errors";
import {
  sendVerificationOutputSchema,
  verifyEmailInputSchema,
  verifyEmailOutputSchema,
} from "@/server/api/v1/_schemas/auth";
import {
  badRequestWithReason,
  conflictWithReason,
  forbiddenWithReason,
  tooManyRequestsWithRetry,
  unauthorizedWithReason,
} from "@/server/api/v1/_schemas/auth-errors";

const AUTH_TAGS = ["auth"];

export const emailVerificationContract = {
  send: oc
    .errors({
      ...unauthorizedWithReason,
      ...forbiddenWithReason,
      ...conflictWithReason,
      ...tooManyRequestsWithRetry,
      ...serviceUnavailableError,
    })
    .route({
      method: "POST",
      path: "/auth/email-verification/send",
      successStatus: 202,
      summary: "Send a verification code to the account's email",
      description: [
        "Emails a 6-digit code, good for 30 minutes and 5 guesses, to the address of the signed-in account. The address is never taken from the request. A new code replaces the previous one. Needs an access token or a browser session.",
        "",
        "409 `already_verified`. 429 with `data.retryAfterSeconds` when a code was sent less than `cooldownSeconds` ago.",
      ].join("\n"),
      tags: AUTH_TAGS,
    })
    .output(sendVerificationOutputSchema),

  verify: oc
    .errors({
      ...unauthorizedWithReason,
      ...forbiddenWithReason,
      ...badRequestWithReason,
      ...conflictWithReason,
      ...tooManyRequestsWithRetry,
    })
    .route({
      method: "POST",
      path: "/auth/email-verification/verify",
      summary: "Confirm the account's email with the code",
      description: [
        "Checks the code against the signed-in account. On success the email-confirmation bonus is credited once; an account created through `POST /auth/register` also receives its welcome grant here.",
        "",
        "400 `invalid_code` with `data.attemptsLeft`; 400 `expired_code` when the code is too old or its guesses are used up (ask for a new one); 409 `already_verified`; 429 `too_many_attempts`.",
      ].join("\n"),
      tags: AUTH_TAGS,
    })
    .input(verifyEmailInputSchema)
    .output(verifyEmailOutputSchema),
};
