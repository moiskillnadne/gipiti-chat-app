import { requireAuth } from "@/server/api/_kit/middleware";
import { v1 } from "@/server/api/v1/implementer";
import {
  getRateLimitResetSeconds,
  VERIFICATION_RESEND_COOLDOWN_SECONDS,
} from "@/server/http/rate-limit";
import { sendVerificationCode } from "@/server/modules/auth/send-verification-code";
import { verifyEmailCode } from "@/server/modules/auth/verify-email-code";
import { getUserById } from "@/server/modules/users/queries/get-by-id";

export const emailVerificationRouter = {
  send: v1.auth.emailVerification.send
    .use(requireAuth)
    .handler(async ({ context, errors }) => {
      // The address comes from the signed-in account, never from the request:
      // this endpoint must not be a way to send mail to an address of choice.
      const user = await getUserById(context.principal.userId);
      if (!user) {
        throw errors.UNAUTHORIZED({ data: { reason: "not_authenticated" } });
      }

      const result = await sendVerificationCode({ email: user.email });

      switch (result.status) {
        case "sent":
          return { cooldownSeconds: VERIFICATION_RESEND_COOLDOWN_SECONDS };
        case "already_verified":
          throw errors.CONFLICT({ data: { reason: "already_verified" } });
        case "rate_limited":
          throw errors.TOO_MANY_REQUESTS({
            data: {
              retryAfterSeconds: getRateLimitResetSeconds(result.resetAt),
            },
          });
        case "unknown_user":
          throw errors.UNAUTHORIZED({ data: { reason: "not_authenticated" } });
        case "limiter_unavailable":
        case "send_failed":
          // The limit could not be checked, or the mail provider refused:
          // nothing was sent, and trying again in a moment is right.
          throw errors.SERVICE_UNAVAILABLE();
        default: {
          const unhandled: never = result;
          throw new Error(`Unhandled result: ${JSON.stringify(unhandled)}`);
        }
      }
    }),

  verify: v1.auth.emailVerification.verify
    .use(requireAuth)
    .handler(async ({ input, context, errors }) => {
      const user = await getUserById(context.principal.userId);
      if (!user) {
        throw errors.UNAUTHORIZED({ data: { reason: "not_authenticated" } });
      }

      // The service's result says a lot about the account; it may be passed
      // on here because the account is the caller's own.
      const result = await verifyEmailCode({
        email: user.email,
        code: input.code,
      });

      switch (result.status) {
        case "verified":
          return {
            emailVerified: true,
            bonusGranted: result.isBonusGranted,
            welcomeGrantCredited: result.isWelcomeGrantCredited,
          };
        case "invalid_code":
          throw errors.BAD_REQUEST({
            data: {
              reason: "invalid_code",
              attemptsLeft: result.attemptsLeft,
            },
          });
        case "expired_code":
          throw errors.BAD_REQUEST({ data: { reason: "expired_code" } });
        case "already_verified":
          throw errors.CONFLICT({ data: { reason: "already_verified" } });
        case "rate_limited":
          throw errors.TOO_MANY_REQUESTS({
            data: { reason: "too_many_attempts" },
          });
        default: {
          const unhandled: never = result;
          throw new Error(`Unhandled result: ${JSON.stringify(unhandled)}`);
        }
      }
    }),
};
