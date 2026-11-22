import { requireAuth } from "@/server/api/_kit/middleware";
import { toTokenPairDto } from "@/server/api/v1/_mappers/auth";
import { v1 } from "@/server/api/v1/implementer";
import { getClientIp } from "@/server/http/client-ip";
import { getRateLimitResetSeconds } from "@/server/http/rate-limit";
import { changePassword } from "@/server/modules/auth/change-password";
import { renewCookieSession } from "@/server/modules/auth/cookie-session";
import { requestPasswordReset } from "@/server/modules/auth/request-password-reset";
import { resetPassword } from "@/server/modules/auth/reset-password";
import {
  issueTokenPair,
  listSessions,
  type SessionClient,
  type TokenPair,
} from "@/server/modules/auth/sessions";

/** Recorded for a session whose predecessor could not be found. */
const UNKNOWN_PLATFORM = "unknown";

/**
 * What the caller's current session says about its client, read before the
 * password change ends that session, to open its successor with.
 */
const clientOfSession = async (
  userId: string,
  sessionId: string
): Promise<SessionClient> => {
  const sessions = await listSessions(userId);
  const current = sessions.find((session) => session.id === sessionId);

  return {
    platform: current?.platform ?? UNKNOWN_PLATFORM,
    deviceName: current?.deviceName ?? undefined,
    appVersion: current?.appVersion ?? undefined,
  };
};

/**
 * `issueTokenPair` for a moment when a failure must not fail the request:
 * null instead of a throw.
 */
const issueTokenPairSafely = async (
  input: Parameters<typeof issueTokenPair>[0]
): Promise<TokenPair | null> => {
  try {
    return await issueTokenPair(input);
  } catch (error) {
    console.error("[password/change] could not open a new session:", error);
    return null;
  }
};

export const passwordRouter = {
  forgot: v1.auth.password.forgot.handler(async ({ input, errors }) => {
    const result = await requestPasswordReset({ email: input.email });

    switch (result.status) {
      case "rate_limited":
        throw errors.TOO_MANY_REQUESTS({
          data: {
            retryAfterSeconds: getRateLimitResetSeconds(result.resetAt),
          },
        });
      case "limiter_unavailable":
        throw errors.SERVICE_UNAVAILABLE();
      case "sent":
      case "unknown_user":
      case "send_failed":
        // One answer for all three. A different answer when the mail could
        // not be sent would say that the address has an account; the
        // service has logged the failure.
        return;
      default: {
        const unhandled: never = result;
        throw new Error(`Unhandled result: ${JSON.stringify(unhandled)}`);
      }
    }
  }),

  reset: v1.auth.password.reset.handler(async ({ input, errors }) => {
    const result = await resetPassword({
      token: input.token,
      password: input.password,
    });

    if (result.status !== "password_reset") {
      throw errors.BAD_REQUEST({ data: { reason: result.status } });
    }
  }),

  change: v1.auth.password.change
    .use(requireAuth)
    .handler(async ({ input, context, errors }) => {
      const { userId, sessionId } = context.principal;
      const ip = getClientIp(context.request.headers);

      const client =
        sessionId === null ? null : await clientOfSession(userId, sessionId);

      const result = await changePassword({
        userId,
        currentPassword: input.currentPassword,
        newPassword: input.newPassword,
        ip,
      });

      switch (result.status) {
        case "password_changed":
          break;
        case "weak_password":
          throw errors.BAD_REQUEST({ data: { reason: "weak_password" } });
        case "invalid_credentials":
          throw errors.UNAUTHORIZED({
            data: { reason: "invalid_credentials" },
          });
        case "rate_limited":
          throw errors.TOO_MANY_REQUESTS();
        case "limiter_unavailable":
          throw errors.SERVICE_UNAVAILABLE();
        default: {
          const unhandled: never = result;
          throw new Error(`Unhandled result: ${JSON.stringify(unhandled)}`);
        }
      }

      // The change ended every session of the account, the caller's own
      // included. The caller proved the current password, so it gets a new
      // one of the kind it came with. The password is changed for good by
      // now: whatever happens to the new session, the answer is 200, and
      // `sessionRenewed` says whether the caller is still signed in.
      const { account } = result;

      if (client === null) {
        const isCookieRenewed = await renewCookieSession({
          email: account.email,
          password: input.newPassword,
        });

        return { tokens: null, sessionRenewed: isCookieRenewed };
      }

      const tokens = await issueTokenPairSafely({
        userId: account.id,
        tokenVersion: account.tokenVersion,
        client,
        ip,
      });

      return {
        tokens: tokens ? toTokenPairDto(tokens) : null,
        sessionRenewed: tokens !== null,
      };
    }),
};
