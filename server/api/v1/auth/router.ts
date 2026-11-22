import { requireAuth } from "@/server/api/_kit/middleware";
import { toTokenPairDto } from "@/server/api/v1/_mappers/auth";
import { authSessionsRouter } from "@/server/api/v1/auth/sessions/router";
import { v1 } from "@/server/api/v1/implementer";
import { loadMe } from "@/server/api/v1/me/load-me";
import { getClientIp } from "@/server/http/client-ip";
import { authenticateCredentials } from "@/server/modules/auth/authenticate-credentials";
import {
  endAllSessions,
  endSession,
  issueTokenPair,
  refreshTokenPair,
} from "@/server/modules/auth/sessions";

export const authRouter = {
  login: v1.auth.login.handler(async ({ input, context, errors }) => {
    const ip = getClientIp(context.request.headers);

    const result = await authenticateCredentials({
      email: input.email,
      password: input.password,
      ip,
    });

    if (result.status === "rate_limited") {
      throw errors.TOO_MANY_REQUESTS();
    }
    if (result.status === "limiter_unavailable") {
      throw errors.SERVICE_UNAVAILABLE();
    }
    if (result.status === "invalid_credentials") {
      throw errors.UNAUTHORIZED({ data: { reason: "invalid_credentials" } });
    }

    const { id: userId } = result.account;
    const tokens = await issueTokenPair({ userId, client: input.client, ip });
    const user = tokens ? await loadMe(userId) : null;

    // The account was deleted between the password check and here.
    if (!(tokens && user)) {
      throw errors.UNAUTHORIZED({ data: { reason: "invalid_credentials" } });
    }

    return { user, tokens: toTokenPairDto(tokens) };
  }),

  refresh: v1.auth.refresh.handler(async ({ input, errors }) => {
    const result = await refreshTokenPair({
      refreshToken: input.refreshToken,
    });

    if (result.status !== "refreshed") {
      throw errors.UNAUTHORIZED({ data: { reason: result.status } });
    }

    return { tokens: toTokenPairDto(result.tokens) };
  }),

  logout: v1.auth.logout
    .use(requireAuth)
    .handler(async ({ context, errors }) => {
      const { userId, sessionId } = context.principal;

      // A browser session has no API session to end, and the website signs
      // out through Auth.js.
      if (sessionId === null) {
        throw errors.UNAUTHORIZED({ data: { reason: "bearer_required" } });
      }

      await endSession({ userId, sessionId });
    }),

  logoutAll: v1.auth.logoutAll.use(requireAuth).handler(async ({ context }) => {
    await endAllSessions(context.principal.userId);
  }),

  sessions: authSessionsRouter,
};
