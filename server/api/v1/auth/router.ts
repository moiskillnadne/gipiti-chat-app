import type { UtmData } from "@/lib/utm/constants";
import { requireAuth } from "@/server/api/_kit/middleware";
import { toTokenPairDto } from "@/server/api/v1/_mappers/auth";
import { emailVerificationRouter } from "@/server/api/v1/auth/email-verification/router";
import { passwordRouter } from "@/server/api/v1/auth/password/router";
import { authSessionsRouter } from "@/server/api/v1/auth/sessions/router";
import { v1 } from "@/server/api/v1/implementer";
import { loadMe } from "@/server/api/v1/me/load-me";
import { getClientIp } from "@/server/http/client-ip";
import { authenticateCredentials } from "@/server/modules/auth/authenticate-credentials";
import { registerUser } from "@/server/modules/auth/register-user";
import {
  getRegistrationGeoFromHeaders,
  sanitizeLanguage,
} from "@/server/modules/auth/registration-geo";
import {
  assertSessionsCanBeIssued,
  endAllSessions,
  endSession,
  issueTokenPair,
  refreshTokenPair,
} from "@/server/modules/auth/sessions";

type UtmInput = {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
};

/** The request's UTM fields in the shape the account stores them. */
const toUtmData = (utm: UtmInput | undefined): UtmData | undefined =>
  utm && {
    utmSource: utm.source ?? null,
    utmMedium: utm.medium ?? null,
    utmCampaign: utm.campaign ?? null,
    utmContent: utm.content ?? null,
    utmTerm: utm.term ?? null,
  };

export const authRouter = {
  register: v1.auth.register.handler(async ({ input, context, errors }) => {
    const { request } = context;
    const ip = getClientIp(request.headers);

    // Checked before the account exists: an account whose first sign-in
    // then failed would have its email taken with nobody signed in.
    assertSessionsCanBeIssued();

    const geoHeaders = await getRegistrationGeoFromHeaders(() =>
      Promise.resolve(request.headers)
    );

    const result = await registerUser({
      email: input.email,
      password: input.password,
      ip,
      utm: toUtmData(input.utm),
      geo: {
        ...geoHeaders,
        language: sanitizeLanguage(input.language ?? null),
      },
      // An account created here gets its welcome grant when the email is
      // verified, not now; see `registerUser`.
      signupPlatform: input.client.platform,
    });

    switch (result.status) {
      case "registered":
        break;
      case "signup_disabled":
        throw errors.FORBIDDEN({ data: { reason: "signup_disabled" } });
      case "weak_password":
        throw errors.BAD_REQUEST({ data: { reason: "weak_password" } });
      case "disposable_email":
        throw errors.BAD_REQUEST({ data: { reason: "disposable_email" } });
      case "user_exists":
        throw errors.CONFLICT({ data: { reason: "email_taken" } });
      case "rate_limited":
        throw errors.TOO_MANY_REQUESTS();
      case "limiter_unavailable":
        throw errors.SERVICE_UNAVAILABLE();
      default: {
        const unhandled: never = result;
        throw new Error(`Unhandled result: ${JSON.stringify(unhandled)}`);
      }
    }

    const { id: userId, tokenVersion } = result.account;
    const tokens = await issueTokenPair({
      userId,
      tokenVersion,
      client: input.client,
      ip,
    });
    const user = tokens ? await loadMe(userId) : null;

    if (!(tokens && user)) {
      throw new Error(`The new account ${userId} could not be signed in`);
    }

    return { user, tokens: toTokenPairDto(tokens) };
  }),

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

    const { id: userId, tokenVersion } = result.account;
    const tokens = await issueTokenPair({
      userId,
      tokenVersion,
      client: input.client,
      ip,
    });
    const user = tokens ? await loadMe(userId) : null;

    // Between the password check and here the account was deleted, or its
    // password was reset: the password that was checked is no longer good.
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
  emailVerification: emailVerificationRouter,
  password: passwordRouter,
};
