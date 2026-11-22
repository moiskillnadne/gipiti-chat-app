import { beforeEach, describe, expect, it, vi } from "vitest";

import { createHandler } from "@/server/api/_kit/create-handler";
import type { Me } from "@/server/api/v1/_schemas/me";
import { loadMe } from "@/server/api/v1/me/load-me";
import { v1Router } from "@/server/api/v1/router";
import { authenticateCredentials } from "@/server/modules/auth/authenticate-credentials";
import { getCookieSessionUserId } from "@/server/modules/auth/cookie-session";
import {
  endAllSessions,
  endSession,
  endSessionById,
  issueTokenPair,
  listSessions,
  refreshTokenPair,
  resolveBearerSession,
  type TokenPair,
} from "@/server/modules/auth/sessions";

// The handler, the router, the middlewares (with the CSRF and principal
// guards) and the mappers are real. The auth services are replaced.
vi.mock("server-only", () => ({}));
vi.mock("@/server/db/connection", () => ({ db: {} }));
vi.mock("@/server/flags", () => ({
  isSignupEnabled: vi.fn(),
  isTopupEnabled: { run: vi.fn() },
}));
vi.mock("@/server/api/v1/me/load-me", () => ({ loadMe: vi.fn() }));
vi.mock("@/server/modules/auth/authenticate-credentials", () => ({
  authenticateCredentials: vi.fn(),
}));
vi.mock("@/server/modules/auth/cookie-session", () => ({
  getCookieSessionUserId: vi.fn(),
}));
// The account endpoints, whose services reach the mail sender, have their
// own suite (`account-http.test.ts`).
vi.mock("@/server/modules/auth/change-password", () => ({
  changePassword: vi.fn(),
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
vi.mock("@/server/modules/auth/verify-email-code", () => ({
  verifyEmailCode: vi.fn(),
}));
vi.mock("@/server/modules/auth/sessions", () => ({
  endAllSessions: vi.fn(),
  endSession: vi.fn(),
  endSessionById: vi.fn(),
  issueTokenPair: vi.fn(),
  listSessions: vi.fn(),
  refreshTokenPair: vi.fn(),
  resolveBearerSession: vi.fn(),
}));

const ORIGIN = "https://gipiti.test";
const PREFIX = "/api/v1";
const USER_ID = "3f0c1b7e-7c0a-4a52-9d1b-1d2a3b4c5d6e";
const SESSION_ID = "9d1b3f0c-1b7e-4a52-8c0a-6e5d4c3b2a1d";
const OTHER_SESSION_ID = "1d2a3b4c-5d6e-4a52-9d1b-3f0c1b7e7c0a";
const EMAIL = "user@example.test";
const PASSWORD = "typed-password";
const CLIENT_IP = "203.0.113.7";
const ACCESS_TOKEN = "header.payload.signature";
const REFRESH_TOKEN = "r".repeat(43);
const CLIENT = {
  platform: "ios",
  deviceName: "Test iPhone",
  appVersion: "1.0.0",
};

const BEARER = { authorization: `Bearer ${ACCESS_TOKEN}` };
const SAME_ORIGIN = { "sec-fetch-site": "same-origin" };
const CROSS_SITE = { "sec-fetch-site": "cross-site" };

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
  emailVerified: true,
  isTester: false,
  hasActiveSubscription: false,
  balance: null,
  features: { topup: false },
};
const TOKEN_VERSION = 3;
const ACCOUNT = {
  id: USER_ID,
  email: EMAIL,
  emailVerified: true,
  isTester: false,
  tokenVersion: TOKEN_VERSION,
};

const handlers = createHandler(v1Router, { prefix: PREFIX });

type CallInit = {
  method?: keyof typeof handlers;
  headers?: Record<string, string>;
  body?: unknown;
};

const call = (
  path: string,
  { method = "POST", headers = {}, body }: CallInit = {}
): Promise<Response> =>
  handlers[method](
    new Request(`${ORIGIN}${PREFIX}${path}`, {
      method,
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
  vi.mocked(authenticateCredentials).mockResolvedValue({
    status: "authenticated",
    account: ACCOUNT,
  });
  vi.mocked(issueTokenPair).mockResolvedValue(TOKEN_PAIR);
  vi.mocked(loadMe).mockResolvedValue(ME);
  vi.mocked(refreshTokenPair).mockResolvedValue({
    status: "refreshed",
    tokens: TOKEN_PAIR,
  });
  vi.mocked(endSession).mockResolvedValue(true);
  vi.mocked(endSessionById).mockResolvedValue(true);
  vi.mocked(listSessions).mockResolvedValue([]);
});

describe("POST /auth/login", () => {
  const loginBody = { email: EMAIL, password: PASSWORD, client: CLIENT };

  it("answers the user and a token pair, with dates as ISO strings", async () => {
    // Act
    const response = await call("/auth/login", {
      body: loginBody,
      headers: { "x-forwarded-for": CLIENT_IP },
    });

    // Assert
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ user: ME, tokens: TOKEN_PAIR_DTO });
    expect(authenticateCredentials).toHaveBeenCalledExactlyOnceWith({
      email: EMAIL,
      password: PASSWORD,
      ip: CLIENT_IP,
    });
    // The session is issued under the version read with the credentials.
    expect(issueTokenPair).toHaveBeenCalledExactlyOnceWith({
      userId: USER_ID,
      tokenVersion: TOKEN_VERSION,
      client: CLIENT,
      ip: CLIENT_IP,
    });
  });

  it("needs no credentials and ignores a browser session", async () => {
    // Act
    const response = await call("/auth/login", { body: loginBody });

    // Assert
    expect(response.status).toBe(200);
    expect(getCookieSessionUserId).not.toHaveBeenCalled();
  });

  it("answers 401 invalid_credentials and opens no session for a wrong password", async () => {
    // Arrange
    vi.mocked(authenticateCredentials).mockResolvedValue({
      status: "invalid_credentials",
    });

    // Act
    const response = await call("/auth/login", { body: loginBody });

    // Assert
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      defined: true,
      code: "UNAUTHORIZED",
      data: { reason: "invalid_credentials" },
    });
    expect(issueTokenPair).not.toHaveBeenCalled();
  });

  it.each<[string, "rate_limited" | "limiter_unavailable", number, string]>([
    ["the limit is reached", "rate_limited", 429, "TOO_MANY_REQUESTS"],
    [
      "the limit cannot be checked",
      "limiter_unavailable",
      503,
      "SERVICE_UNAVAILABLE",
    ],
  ])(
    "answers %s without opening a session",
    async (_case, status, httpStatus, code) => {
      // Arrange
      vi.mocked(authenticateCredentials).mockResolvedValue({ status });

      // Act
      const response = await call("/auth/login", { body: loginBody });

      // Assert
      expect(response.status).toBe(httpStatus);
      expect(await response.json()).toMatchObject({ defined: true, code });
      expect(issueTokenPair).not.toHaveBeenCalled();
    }
  );

  it("answers 401 when the password was reset, or the account vanished, after the password check", async () => {
    // Arrange
    vi.mocked(issueTokenPair).mockResolvedValue(null);

    // Act
    const response = await call("/auth/login", { body: loginBody });

    // Assert
    expect(response.status).toBe(401);
    expect(loadMe).not.toHaveBeenCalled();
  });

  it.each<[string, unknown]>([
    ["a malformed email", { ...loginBody, email: "not-an-email" }],
    ["an empty password", { ...loginBody, password: "" }],
    ["no client", { email: EMAIL, password: PASSWORD }],
    [
      "a platform that cannot sign in here",
      { ...loginBody, client: { platform: "web" } },
    ],
  ])(
    "answers 400 for %s without checking the password",
    async (_case, body) => {
      // Act
      const response = await call("/auth/login", { body });

      // Assert
      expect(response.status).toBe(400);
      expect((await response.json()).code).toBe("BAD_REQUEST");
      expect(authenticateCredentials).not.toHaveBeenCalled();
    }
  );

  it("answers a sanitised 500 when the token secret is missing", async () => {
    // Arrange
    vi.spyOn(console, "error").mockReturnValue(undefined);
    vi.mocked(issueTokenPair).mockRejectedValue(
      new Error("API_TOKEN_SECRET is not set")
    );

    // Act
    const response = await call("/auth/login", { body: loginBody });
    const body = await response.json();

    // Assert
    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("API_TOKEN_SECRET");
  });
});

describe("POST /auth/refresh", () => {
  it("answers a new pair for a refresh token, with no other credential", async () => {
    // Act
    const response = await call("/auth/refresh", {
      body: { refreshToken: REFRESH_TOKEN },
    });

    // Assert
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ tokens: TOKEN_PAIR_DTO });
    expect(refreshTokenPair).toHaveBeenCalledExactlyOnceWith({
      refreshToken: REFRESH_TOKEN,
    });
    expect(resolveBearerSession).not.toHaveBeenCalled();
  });

  it.each([
    "refresh_invalid",
    "refresh_expired",
    "session_revoked",
    "refresh_reused",
  ] as const)("answers 401 with the reason %s", async (status) => {
    // Arrange
    vi.mocked(refreshTokenPair).mockResolvedValue({ status });

    // Act
    const response = await call("/auth/refresh", {
      body: { refreshToken: REFRESH_TOKEN },
    });

    // Assert
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      defined: true,
      code: "UNAUTHORIZED",
      data: { reason: status },
    });
  });

  it("answers 400 for something too short to be a refresh token", async () => {
    // Act
    const response = await call("/auth/refresh", {
      body: { refreshToken: "short" },
    });

    // Assert
    expect(response.status).toBe(400);
    expect(refreshTokenPair).not.toHaveBeenCalled();
  });
});

describe("POST /auth/logout", () => {
  it("ends the session of the access token and answers 204 with no body", async () => {
    // Act
    const response = await call("/auth/logout", { headers: BEARER });

    // Assert
    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(endSession).toHaveBeenCalledExactlyOnceWith({
      userId: USER_ID,
      sessionId: SESSION_ID,
    });
  });

  it("answers 401 bearer_required to a browser session", async () => {
    // Arrange
    useBrowserSession();

    // Act
    const response = await call("/auth/logout", { headers: SAME_ORIGIN });

    // Assert
    expect(response.status).toBe(401);
    expect((await response.json()).data).toEqual({ reason: "bearer_required" });
    expect(endSession).not.toHaveBeenCalled();
  });

  it("answers 401 not_authenticated to nobody", async () => {
    // Act
    const response = await call("/auth/logout");

    // Assert
    expect(response.status).toBe(401);
    expect((await response.json()).data).toEqual({
      reason: "not_authenticated",
    });
  });

  it("answers 401 invalid_token for a token that is not accepted", async () => {
    // Act
    const response = await call("/auth/logout", {
      headers: { authorization: "Bearer another.token.here" },
    });

    // Assert
    expect(response.status).toBe(401);
    expect((await response.json()).data).toEqual({ reason: "invalid_token" });
  });
});

describe("a request with an access token while the token secret is missing", () => {
  it("answers a sanitised 500, not 401, so the client keeps its session", async () => {
    // Arrange
    vi.spyOn(console, "error").mockReturnValue(undefined);
    vi.mocked(resolveBearerSession).mockRejectedValue(
      new Error("API_TOKEN_SECRET is not set")
    );

    // Act
    const response = await call("/auth/sessions", {
      method: "GET",
      headers: BEARER,
    });
    const body = await response.json();

    // Assert
    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("API_TOKEN_SECRET");
    expect(listSessions).not.toHaveBeenCalled();
  });
});

describe("POST /auth/logout-all", () => {
  it("ends every session for a caller with an access token, who needs no same-origin proof", async () => {
    // Act
    const response = await call("/auth/logout-all", { headers: BEARER });

    // Assert
    expect(response.status).toBe(204);
    expect(endAllSessions).toHaveBeenCalledExactlyOnceWith(USER_ID);
  });

  it("ends every session for a browser session on a same-origin request", async () => {
    // Arrange
    useBrowserSession();

    // Act
    const response = await call("/auth/logout-all", { headers: SAME_ORIGIN });

    // Assert
    expect(response.status).toBe(204);
    expect(endAllSessions).toHaveBeenCalledExactlyOnceWith(USER_ID);
  });

  it.each<[string, Record<string, string>]>([
    ["marked cross-site by the browser", CROSS_SITE],
    ["from another site's Origin", { origin: "https://evil.example" }],
    ["with no proof of where it comes from", {}],
  ])(
    "answers 403 to a browser session on a request %s, and ends nothing",
    async (_case, headers) => {
      // Arrange
      useBrowserSession();

      // Act
      const response = await call("/auth/logout-all", { headers });

      // Assert
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({
        defined: true,
        code: "FORBIDDEN",
        data: { reason: "cross_site_request" },
      });
      expect(endAllSessions).not.toHaveBeenCalled();
    }
  );
});

describe("GET /auth/sessions", () => {
  const liveSession = (id: string) => ({
    id,
    platform: "ios",
    deviceName: "Test iPhone",
    appVersion: "1.0.0",
    createdAt: new Date("2026-11-01T10:00:00.000Z"),
    lastUsedAt: new Date("2026-11-22T11:00:00.000Z"),
  });

  beforeEach(() => {
    vi.mocked(listSessions).mockResolvedValue([
      liveSession(SESSION_ID),
      liveSession(OTHER_SESSION_ID),
    ]);
  });

  it("lists the account's sessions and marks the caller's own", async () => {
    // Act
    const response = await call("/auth/sessions", {
      method: "GET",
      headers: BEARER,
    });
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(listSessions).toHaveBeenCalledExactlyOnceWith(USER_ID);
    expect(body.items).toEqual([
      {
        id: SESSION_ID,
        platform: "ios",
        deviceName: "Test iPhone",
        appVersion: "1.0.0",
        createdAt: "2026-11-01T10:00:00.000Z",
        lastUsedAt: "2026-11-22T11:00:00.000Z",
        isCurrent: true,
      },
      expect.objectContaining({ id: OTHER_SESSION_ID, isCurrent: false }),
    ]);
  });

  it("lists them for a browser session too, none of them current, with no same-origin proof needed for a read", async () => {
    // Arrange
    useBrowserSession();

    // Act
    const response = await call("/auth/sessions", { method: "GET" });
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(
      body.items.map((item: { isCurrent: boolean }) => item.isCurrent)
    ).toEqual([false, false]);
  });

  it("answers 401 without a session", async () => {
    // Act
    const response = await call("/auth/sessions", { method: "GET" });

    // Assert
    expect(response.status).toBe(401);
    expect(listSessions).not.toHaveBeenCalled();
  });
});

describe("DELETE /auth/sessions/{sessionId}", () => {
  it("ends the named session of the caller's account", async () => {
    // Act
    const response = await call(`/auth/sessions/${OTHER_SESSION_ID}`, {
      method: "DELETE",
      headers: BEARER,
    });

    // Assert
    expect(response.status).toBe(204);
    expect(endSessionById).toHaveBeenCalledExactlyOnceWith({
      userId: USER_ID,
      sessionId: OTHER_SESSION_ID,
    });
  });

  it("answers 404 when the account has no live session with this id", async () => {
    // Arrange: also what a session of another account looks like.
    vi.mocked(endSessionById).mockResolvedValue(false);

    // Act
    const response = await call(`/auth/sessions/${OTHER_SESSION_ID}`, {
      method: "DELETE",
      headers: BEARER,
    });

    // Assert
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      defined: true,
      code: "NOT_FOUND",
    });
  });

  it("answers 400 for an id that is not a UUID", async () => {
    // Act
    const response = await call("/auth/sessions/not-a-uuid", {
      method: "DELETE",
      headers: BEARER,
    });

    // Assert
    expect(response.status).toBe(400);
    expect(endSessionById).not.toHaveBeenCalled();
  });

  it("answers 403 to a browser session without same-origin proof", async () => {
    // Arrange
    useBrowserSession();

    // Act
    const response = await call(`/auth/sessions/${OTHER_SESSION_ID}`, {
      method: "DELETE",
    });

    // Assert
    expect(response.status).toBe(403);
    expect(endSessionById).not.toHaveBeenCalled();
  });
});
