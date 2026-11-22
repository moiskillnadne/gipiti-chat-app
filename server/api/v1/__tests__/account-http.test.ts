import { beforeEach, describe, expect, it, vi } from "vitest";

import { createHandler } from "@/server/api/_kit/create-handler";
import type { Me } from "@/server/api/v1/_schemas/me";
import { loadMe } from "@/server/api/v1/me/load-me";
import { v1Router } from "@/server/api/v1/router";
import type { User } from "@/server/db/schema";
import { getRateLimitResetSeconds } from "@/server/http/rate-limit";
import { changePassword } from "@/server/modules/auth/change-password";
import {
  getCookieSessionUserId,
  renewCookieSession,
} from "@/server/modules/auth/cookie-session";
import { registerUser } from "@/server/modules/auth/register-user";
import { requestPasswordReset } from "@/server/modules/auth/request-password-reset";
import { resetPassword } from "@/server/modules/auth/reset-password";
import { sendVerificationCode } from "@/server/modules/auth/send-verification-code";
import {
  assertSessionsCanBeIssued,
  issueTokenPair,
  listSessions,
  resolveBearerSession,
  type TokenPair,
} from "@/server/modules/auth/sessions";
import { verifyEmailCode } from "@/server/modules/auth/verify-email-code";
import { getUserById } from "@/server/modules/users/queries/get-by-id";

// The handler, the router, the middlewares and the mappers are real. The
// auth services, which reach the database and the mail sender, are replaced.
vi.mock("server-only", () => ({}));
vi.mock("@/server/db/connection", () => ({ db: {} }));
vi.mock("@/server/flags", () => ({
  isSignupEnabled: vi.fn(),
  isTopupEnabled: { run: vi.fn() },
}));
vi.mock("@/server/http/rate-limit", () => ({
  VERIFICATION_RESEND_COOLDOWN_SECONDS: 60,
  getRateLimitResetSeconds: vi.fn(),
}));
vi.mock("@/server/api/v1/me/load-me", () => ({ loadMe: vi.fn() }));
vi.mock("@/server/modules/auth/authenticate-credentials", () => ({
  authenticateCredentials: vi.fn(),
}));
vi.mock("@/server/modules/auth/change-password", () => ({
  changePassword: vi.fn(),
}));
vi.mock("@/server/modules/auth/cookie-session", () => ({
  getCookieSessionUserId: vi.fn(),
  renewCookieSession: vi.fn(),
}));
vi.mock("@/server/modules/auth/register-user", () => ({
  registerUser: vi.fn(),
}));
vi.mock("@/server/modules/auth/request-password-reset", () => ({
  requestPasswordReset: vi.fn(),
}));
vi.mock("@/server/modules/auth/reset-password", () => ({
  resetPassword: vi.fn(),
}));
vi.mock("@/server/modules/auth/send-verification-code", () => ({
  sendVerificationCode: vi.fn(),
}));
vi.mock("@/server/modules/auth/sessions", () => ({
  assertSessionsCanBeIssued: vi.fn(),
  endAllSessions: vi.fn(),
  endSession: vi.fn(),
  endSessionById: vi.fn(),
  issueTokenPair: vi.fn(),
  listSessions: vi.fn(),
  refreshTokenPair: vi.fn(),
  resolveBearerSession: vi.fn(),
}));
vi.mock("@/server/modules/auth/verify-email-code", () => ({
  verifyEmailCode: vi.fn(),
}));
vi.mock("@/server/modules/users/queries/get-by-id", () => ({
  getUserById: vi.fn(),
}));

const ORIGIN = "https://gipiti.test";
const PREFIX = "/api/v1";
const USER_ID = "3f0c1b7e-7c0a-4a52-9d1b-1d2a3b4c5d6e";
const SESSION_ID = "9d1b3f0c-1b7e-4a52-8c0a-6e5d4c3b2a1d";
const EMAIL = "user@example.test";
const PASSWORD = "Str0ng!Pass";
const NEW_PASSWORD = "N3w!Password";
const CLIENT_IP = "203.0.113.7";
const ACCESS_TOKEN = "header.payload.signature";
const CODE = "123456";
const RESET_TOKEN = "plain-reset-token";
const RETRY_AFTER_SECONDS = 42;
const TOKEN_VERSION = 0;
const NEW_TOKEN_VERSION = 1;
const CLIENT = {
  platform: "ios",
  deviceName: "Test iPhone",
  appVersion: "1.0.0",
};

const BEARER = { authorization: `Bearer ${ACCESS_TOKEN}` };
const SAME_ORIGIN = { "sec-fetch-site": "same-origin" };

const TOKEN_PAIR: TokenPair = {
  accessToken: "new-access-token",
  accessTokenExpiresAt: new Date("2026-11-22T12:15:00.000Z"),
  refreshToken: "new-refresh-token",
  refreshTokenExpiresAt: new Date("2027-01-21T12:00:00.000Z"),
};
const TOKEN_PAIR_DTO = {
  tokenType: "Bearer",
  accessToken: "new-access-token",
  accessTokenExpiresAt: "2026-11-22T12:15:00.000Z",
  refreshToken: "new-refresh-token",
  refreshTokenExpiresAt: "2027-01-21T12:00:00.000Z",
};
const ME: Me = {
  id: USER_ID,
  email: EMAIL,
  emailVerified: false,
  isTester: false,
  hasActiveSubscription: false,
  balance: null,
  features: { topup: false },
};
const accountAt = (tokenVersion: number) => ({
  id: USER_ID,
  email: EMAIL,
  emailVerified: false,
  isTester: false,
  tokenVersion,
});

const handlers = createHandler(v1Router, { prefix: PREFIX });

type CallInit = { headers?: Record<string, string>; body?: unknown };

const post = (
  path: string,
  { headers = {}, body }: CallInit = {}
): Promise<Response> =>
  handlers.POST(
    new Request(`${ORIGIN}${PREFIX}${path}`, {
      method: "POST",
      headers: {
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  );

const useBrowserSession = (): void => {
  vi.mocked(getCookieSessionUserId).mockResolvedValue(USER_ID);
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCookieSessionUserId).mockResolvedValue(null);
  vi.mocked(resolveBearerSession).mockImplementation(async (token) =>
    token === ACCESS_TOKEN ? { userId: USER_ID, sessionId: SESSION_ID } : null
  );
  vi.mocked(getUserById).mockResolvedValue({
    id: USER_ID,
    email: EMAIL,
  } as User);
  vi.mocked(getRateLimitResetSeconds).mockReturnValue(RETRY_AFTER_SECONDS);
  vi.mocked(issueTokenPair).mockResolvedValue(TOKEN_PAIR);
  vi.mocked(renewCookieSession).mockResolvedValue(true);
  vi.mocked(loadMe).mockResolvedValue(ME);
  vi.mocked(listSessions).mockResolvedValue([]);
});

describe("POST /auth/register", () => {
  const registerBody = {
    email: EMAIL,
    password: PASSWORD,
    language: "ru-RU",
    utm: { source: "store", campaign: "launch" },
    client: CLIENT,
  };

  beforeEach(() => {
    vi.mocked(registerUser).mockResolvedValue({
      status: "registered",
      account: accountAt(TOKEN_VERSION),
    });
  });

  it("creates the account, signs it in and answers 201", async () => {
    // Act
    const response = await post("/auth/register", { body: registerBody });

    // Assert
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ user: ME, tokens: TOKEN_PAIR_DTO });
    expect(issueTokenPair).toHaveBeenCalledExactlyOnceWith({
      userId: USER_ID,
      tokenVersion: TOKEN_VERSION,
      client: CLIENT,
      ip: null,
    });
  });

  it("registers with the caller's address, geo, language and UTM, and always as an API sign-up", async () => {
    // Act
    await post("/auth/register", {
      body: registerBody,
      headers: {
        "x-forwarded-for": CLIENT_IP,
        "x-vercel-ip-country": "RU",
        "x-vercel-ip-country-region": "MOW",
        "x-vercel-ip-city": "Moscow",
      },
    });

    // Assert
    expect(registerUser).toHaveBeenCalledExactlyOnceWith({
      email: EMAIL,
      password: PASSWORD,
      ip: CLIENT_IP,
      utm: {
        utmSource: "store",
        utmMedium: null,
        utmCampaign: "launch",
        utmContent: null,
        utmTerm: null,
      },
      geo: { country: "RU", region: "MOW", city: "Moscow", language: "ru-RU" },
      // What defers the welcome grant until the email is verified.
      signupPlatform: "ios",
    });
  });

  it("drops a language that is not a language tag and sends no UTM when none is given", async () => {
    // Act
    await post("/auth/register", {
      body: {
        email: EMAIL,
        password: PASSWORD,
        language: "<script>",
        client: { platform: "android" },
      },
    });

    // Assert
    expect(registerUser).toHaveBeenCalledWith(
      expect.objectContaining({
        utm: undefined,
        geo: expect.objectContaining({ language: null }),
        signupPlatform: "android",
      })
    );
  });

  type RefusedRegistration = {
    status: Exclude<
      Awaited<ReturnType<typeof registerUser>>,
      { account: unknown }
    >["status"];
    httpStatus: number;
    code: string;
    reason?: string;
  };

  it.each<[string, RefusedRegistration]>([
    [
      "sign-up is switched off",
      {
        status: "signup_disabled",
        httpStatus: 403,
        code: "FORBIDDEN",
        reason: "signup_disabled",
      },
    ],
    [
      "the password is weak",
      {
        status: "weak_password",
        httpStatus: 400,
        code: "BAD_REQUEST",
        reason: "weak_password",
      },
    ],
    [
      "the mailbox is a throwaway one",
      {
        status: "disposable_email",
        httpStatus: 400,
        code: "BAD_REQUEST",
        reason: "disposable_email",
      },
    ],
    [
      "the email has an account",
      {
        status: "user_exists",
        httpStatus: 409,
        code: "CONFLICT",
        reason: "email_taken",
      },
    ],
    [
      "the limit is reached",
      { status: "rate_limited", httpStatus: 429, code: "TOO_MANY_REQUESTS" },
    ],
    [
      "the limit cannot be checked",
      {
        status: "limiter_unavailable",
        httpStatus: 503,
        code: "SERVICE_UNAVAILABLE",
      },
    ],
  ])("opens no session when %s", async (_case, refusal) => {
    // Arrange
    vi.mocked(registerUser).mockResolvedValue({ status: refusal.status });

    // Act
    const response = await post("/auth/register", { body: registerBody });
    const body = await response.json();

    // Assert
    expect(response.status).toBe(refusal.httpStatus);
    expect(body).toMatchObject({ defined: true, code: refusal.code });
    expect(body.data?.reason).toBe(refusal.reason);
    expect(issueTokenPair).not.toHaveBeenCalled();
  });

  it.each<[string, () => void]>([
    [
      "the session",
      () => {
        vi.mocked(issueTokenPair).mockResolvedValue(null);
      },
    ],
    [
      "the profile",
      () => {
        vi.mocked(loadMe).mockResolvedValue(null);
      },
    ],
  ])(
    "answers a sanitised 500 when the account exists but %s could not be produced",
    async (_case, arrange) => {
      // Arrange
      vi.spyOn(console, "error").mockReturnValue(undefined);
      arrange();

      // Act
      const response = await post("/auth/register", { body: registerBody });

      // Assert: the client recovers by signing in; see the description.
      expect(response.status).toBe(500);
      expect((await response.json()).message).toBe("Internal server error");
    }
  );

  it("creates no account when sessions cannot be issued at all", async () => {
    // Arrange: the token secret is missing.
    vi.spyOn(console, "error").mockReturnValue(undefined);
    vi.mocked(assertSessionsCanBeIssued).mockImplementation(() => {
      throw new Error("API_TOKEN_SECRET is not set");
    });

    // Act
    const response = await post("/auth/register", { body: registerBody });

    // Assert: otherwise the email would be taken with nobody signed in.
    expect(response.status).toBe(500);
    expect(registerUser).not.toHaveBeenCalled();
  });

  it.each<[string, unknown]>([
    ["a malformed email", { ...registerBody, email: "not-an-email" }],
    ["no client", { email: EMAIL, password: PASSWORD }],
    ["the platform web", { ...registerBody, client: { platform: "web" } }],
    [
      "a UTM value that is too long",
      { ...registerBody, utm: { source: "s".repeat(256) } },
    ],
  ])("answers 400 for %s and registers nobody", async (_case, body) => {
    // Act
    const response = await post("/auth/register", { body });

    // Assert
    expect(response.status).toBe(400);
    expect(registerUser).not.toHaveBeenCalled();
  });
});

describe("POST /auth/email-verification/send", () => {
  beforeEach(() => {
    vi.mocked(sendVerificationCode).mockResolvedValue({ status: "sent" });
  });

  it("sends a code to the address of the signed-in account and answers 202 with the cooldown", async () => {
    // Act
    const response = await post("/auth/email-verification/send", {
      headers: BEARER,
      // An address in the body is not looked at.
      body: { email: "someone-else@example.test" },
    });

    // Assert
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ cooldownSeconds: 60 });
    expect(sendVerificationCode).toHaveBeenCalledExactlyOnceWith({
      email: EMAIL,
    });
  });

  it("answers 409 already_verified", async () => {
    // Arrange
    vi.mocked(sendVerificationCode).mockResolvedValue({
      status: "already_verified",
    });

    // Act
    const response = await post("/auth/email-verification/send", {
      headers: BEARER,
    });

    // Assert
    expect(response.status).toBe(409);
    expect((await response.json()).data).toEqual({
      reason: "already_verified",
    });
  });

  it("answers 429 with the seconds to wait", async () => {
    // Arrange
    vi.mocked(sendVerificationCode).mockResolvedValue({
      status: "rate_limited",
      resetAt: 1_900_000_000_000,
    });

    // Act
    const response = await post("/auth/email-verification/send", {
      headers: BEARER,
    });

    // Assert
    expect(response.status).toBe(429);
    expect((await response.json()).data).toEqual({
      retryAfterSeconds: RETRY_AFTER_SECONDS,
    });
    expect(getRateLimitResetSeconds).toHaveBeenCalledWith(1_900_000_000_000);
  });

  it.each(["limiter_unavailable", "send_failed"] as const)(
    "answers 503 when the service reports %s",
    async (status) => {
      // Arrange
      vi.mocked(sendVerificationCode).mockResolvedValue({ status });

      // Act
      const response = await post("/auth/email-verification/send", {
        headers: BEARER,
      });

      // Assert
      expect(response.status).toBe(503);
    }
  );

  it("answers 401 without a session and sends nothing", async () => {
    // Act
    const response = await post("/auth/email-verification/send");

    // Assert
    expect(response.status).toBe(401);
    expect(sendVerificationCode).not.toHaveBeenCalled();
  });

  it("answers 403 to a browser session without same-origin proof", async () => {
    // Arrange
    useBrowserSession();

    // Act
    const response = await post("/auth/email-verification/send");

    // Assert
    expect(response.status).toBe(403);
    expect(sendVerificationCode).not.toHaveBeenCalled();
  });
});

describe("POST /auth/email-verification/verify", () => {
  beforeEach(() => {
    vi.mocked(verifyEmailCode).mockResolvedValue({
      status: "verified",
      isBonusGranted: true,
      isWelcomeGrantCredited: true,
    });
  });

  it("checks the code against the signed-in account and reports what was credited", async () => {
    // Act
    const response = await post("/auth/email-verification/verify", {
      headers: BEARER,
      body: { code: CODE },
    });

    // Assert
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      emailVerified: true,
      bonusGranted: true,
      welcomeGrantCredited: true,
    });
    expect(verifyEmailCode).toHaveBeenCalledExactlyOnceWith({
      email: EMAIL,
      code: CODE,
    });
  });

  it("works for a browser session on a same-origin request", async () => {
    // Arrange
    useBrowserSession();

    // Act
    const response = await post("/auth/email-verification/verify", {
      headers: SAME_ORIGIN,
      body: { code: CODE },
    });

    // Assert
    expect(response.status).toBe(200);
  });

  it("answers 400 invalid_code with the guesses left", async () => {
    // Arrange
    vi.mocked(verifyEmailCode).mockResolvedValue({
      status: "invalid_code",
      attemptsLeft: 3,
    });

    // Act
    const response = await post("/auth/email-verification/verify", {
      headers: BEARER,
      body: { code: CODE },
    });

    // Assert
    expect(response.status).toBe(400);
    expect((await response.json()).data).toEqual({
      reason: "invalid_code",
      attemptsLeft: 3,
    });
  });

  it.each<
    ["expired_code" | "already_verified" | "rate_limited", number, string]
  >([
    ["expired_code", 400, "expired_code"],
    ["already_verified", 409, "already_verified"],
    ["rate_limited", 429, "too_many_attempts"],
  ])(
    "answers %s as %i with the reason %s",
    async (status, httpStatus, reason) => {
      // Arrange
      vi.mocked(verifyEmailCode).mockResolvedValue({ status });

      // Act
      const response = await post("/auth/email-verification/verify", {
        headers: BEARER,
        body: { code: CODE },
      });

      // Assert
      expect(response.status).toBe(httpStatus);
      expect((await response.json()).data).toMatchObject({ reason });
    }
  );

  it.each(["12345", "1234567", "12345a", ""])(
    "answers 400 for the code %j without spending an attempt",
    async (code) => {
      // Act
      const response = await post("/auth/email-verification/verify", {
        headers: BEARER,
        body: { code },
      });

      // Assert
      expect(response.status).toBe(400);
      expect(verifyEmailCode).not.toHaveBeenCalled();
    }
  );

  it("answers 503, not 429, when the limit cannot be checked", async () => {
    // Arrange
    vi.mocked(verifyEmailCode).mockResolvedValue({
      status: "limiter_unavailable",
    });

    // Act
    const response = await post("/auth/email-verification/verify", {
      headers: BEARER,
      body: { code: CODE },
    });

    // Assert
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe("SERVICE_UNAVAILABLE");
  });

  it("answers 401 without a session", async () => {
    // Act
    const response = await post("/auth/email-verification/verify", {
      body: { code: CODE },
    });

    // Assert
    expect(response.status).toBe(401);
    expect(verifyEmailCode).not.toHaveBeenCalled();
  });

  it("answers 403 to a browser session without same-origin proof", async () => {
    // Arrange
    useBrowserSession();

    // Act
    const response = await post("/auth/email-verification/verify", {
      body: { code: CODE },
    });

    // Assert
    expect(response.status).toBe(403);
    expect(verifyEmailCode).not.toHaveBeenCalled();
  });
});

describe("POST /auth/password/forgot", () => {
  it.each(["sent", "unknown_user", "send_failed"] as const)(
    "answers 202 with no body when the service reports %s, so the answer says nothing about the address",
    async (status) => {
      // Arrange
      vi.mocked(requestPasswordReset).mockResolvedValue({ status });

      // Act
      const response = await post("/auth/password/forgot", {
        body: { email: EMAIL },
      });

      // Assert
      expect(response.status).toBe(202);
      expect(await response.text()).toBe("");
      expect(requestPasswordReset).toHaveBeenCalledExactlyOnceWith({
        email: EMAIL,
      });
    }
  );

  it("answers 429 with the seconds to wait", async () => {
    // Arrange
    vi.mocked(requestPasswordReset).mockResolvedValue({
      status: "rate_limited",
      resetAt: 1_900_000_000_000,
    });

    // Act
    const response = await post("/auth/password/forgot", {
      body: { email: EMAIL },
    });

    // Assert
    expect(response.status).toBe(429);
    expect((await response.json()).data).toEqual({
      retryAfterSeconds: RETRY_AFTER_SECONDS,
    });
  });

  it("answers 503 when the limit cannot be checked", async () => {
    // Arrange
    vi.mocked(requestPasswordReset).mockResolvedValue({
      status: "limiter_unavailable",
    });

    // Act
    const response = await post("/auth/password/forgot", {
      body: { email: EMAIL },
    });

    // Assert
    expect(response.status).toBe(503);
  });

  it("answers 400 for a malformed email", async () => {
    // Act
    const response = await post("/auth/password/forgot", {
      body: { email: "not-an-email" },
    });

    // Assert
    expect(response.status).toBe(400);
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });
});

describe("POST /auth/password/reset", () => {
  it("sets the password for the token and answers 204", async () => {
    // Arrange
    vi.mocked(resetPassword).mockResolvedValue({ status: "password_reset" });

    // Act
    const response = await post("/auth/password/reset", {
      body: { token: RESET_TOKEN, password: NEW_PASSWORD },
    });

    // Assert
    expect(response.status).toBe(204);
    expect(resetPassword).toHaveBeenCalledExactlyOnceWith({
      token: RESET_TOKEN,
      password: NEW_PASSWORD,
    });
  });

  it.each(["invalid_token", "weak_password"] as const)(
    "answers 400 with the reason %s",
    async (status) => {
      // Arrange
      vi.mocked(resetPassword).mockResolvedValue({ status });

      // Act
      const response = await post("/auth/password/reset", {
        body: { token: RESET_TOKEN, password: NEW_PASSWORD },
      });

      // Assert
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        defined: true,
        data: { reason: status },
      });
    }
  );
});

describe("POST /auth/password/change", () => {
  const changeBody = { currentPassword: PASSWORD, newPassword: NEW_PASSWORD };

  beforeEach(() => {
    vi.mocked(changePassword).mockResolvedValue({
      status: "password_changed",
      account: accountAt(NEW_TOKEN_VERSION),
    });
  });

  it("gives a caller with an access token a new pair, opened for the same device under the new token version", async () => {
    // Arrange
    vi.mocked(listSessions).mockResolvedValue([
      {
        id: SESSION_ID,
        platform: "ios",
        deviceName: "Test iPhone",
        appVersion: "1.0.0",
        createdAt: new Date(),
        lastUsedAt: new Date(),
      },
    ]);

    // Act
    const response = await post("/auth/password/change", {
      headers: { ...BEARER, "x-forwarded-for": CLIENT_IP },
      body: changeBody,
    });

    // Assert
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      tokens: TOKEN_PAIR_DTO,
      sessionRenewed: true,
    });
    expect(changePassword).toHaveBeenCalledExactlyOnceWith({
      userId: USER_ID,
      currentPassword: PASSWORD,
      newPassword: NEW_PASSWORD,
      ip: CLIENT_IP,
    });
    expect(issueTokenPair).toHaveBeenCalledExactlyOnceWith({
      userId: USER_ID,
      tokenVersion: NEW_TOKEN_VERSION,
      client: CLIENT,
      ip: CLIENT_IP,
    });
    expect(renewCookieSession).not.toHaveBeenCalled();
  });

  it("gives a browser session a fresh cookie and no tokens", async () => {
    // Arrange
    useBrowserSession();

    // Act
    const response = await post("/auth/password/change", {
      headers: SAME_ORIGIN,
      body: changeBody,
    });

    // Assert
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      tokens: null,
      sessionRenewed: true,
    });
    expect(renewCookieSession).toHaveBeenCalledExactlyOnceWith({
      email: EMAIL,
      password: NEW_PASSWORD,
    });
    expect(issueTokenPair).not.toHaveBeenCalled();
  });

  it.each<
    [
      Exclude<
        Awaited<ReturnType<typeof changePassword>>,
        { account: unknown }
      >["status"],
      number,
      string | undefined,
    ]
  >([
    ["invalid_credentials", 401, "invalid_credentials"],
    ["weak_password", 400, "weak_password"],
    ["rate_limited", 429, undefined],
    ["limiter_unavailable", 503, undefined],
  ])(
    "answers %s as %i and opens no new session",
    async (status, httpStatus, reason) => {
      // Arrange
      vi.mocked(changePassword).mockResolvedValue({ status });

      // Act
      const response = await post("/auth/password/change", {
        headers: BEARER,
        body: changeBody,
      });

      // Assert
      expect(response.status).toBe(httpStatus);
      expect((await response.json()).data?.reason).toBe(reason);
      expect(issueTokenPair).not.toHaveBeenCalled();
      expect(renewCookieSession).not.toHaveBeenCalled();
    }
  );

  it("still answers 200 when the browser's cookie could not be renewed, and says so", async () => {
    // Arrange: the password is already changed when this fails.
    useBrowserSession();
    vi.mocked(renewCookieSession).mockResolvedValue(false);

    // Act
    const response = await post("/auth/password/change", {
      headers: SAME_ORIGIN,
      body: changeBody,
    });

    // Assert
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      tokens: null,
      sessionRenewed: false,
    });
  });

  it.each<[string, () => void]>([
    [
      "is refused",
      () => {
        vi.mocked(issueTokenPair).mockResolvedValue(null);
      },
    ],
    [
      "fails",
      () => {
        vi.mocked(issueTokenPair).mockRejectedValue(new Error("db down"));
      },
    ],
  ])(
    "still answers 200 to a caller with an access token when the new session %s",
    async (_case, arrange) => {
      // Arrange
      vi.spyOn(console, "error").mockReturnValue(undefined);
      arrange();

      // Act
      const response = await post("/auth/password/change", {
        headers: BEARER,
        body: changeBody,
      });

      // Assert: a 500 here would hide that the password did change.
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        tokens: null,
        sessionRenewed: false,
      });
    }
  );

  it("opens the new session for an unknown device when the old session is no longer listed", async () => {
    // Arrange: `listSessions` answers nothing for the caller's session.
    vi.mocked(listSessions).mockResolvedValue([]);

    // Act
    await post("/auth/password/change", { headers: BEARER, body: changeBody });

    // Assert
    expect(issueTokenPair).toHaveBeenCalledWith(
      expect.objectContaining({
        client: {
          platform: "unknown",
          deviceName: undefined,
          appVersion: undefined,
        },
      })
    );
  });

  it("answers 401 without a session and 403 to a browser session without same-origin proof", async () => {
    // Act
    const anonymous = await post("/auth/password/change", { body: changeBody });
    useBrowserSession();
    const crossSite = await post("/auth/password/change", { body: changeBody });

    // Assert
    expect(anonymous.status).toBe(401);
    expect(crossSite.status).toBe(403);
    expect(changePassword).not.toHaveBeenCalled();
  });
});
