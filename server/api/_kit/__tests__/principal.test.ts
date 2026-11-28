import { beforeEach, describe, expect, it, vi } from "vitest";

import { resolvePrincipal } from "@/server/api/_kit/guards/principal";
import { getCookieSessionUserId } from "@/server/modules/auth/cookie-session";
import { resolveBearerSession } from "@/server/modules/auth/sessions";

vi.mock("@/server/modules/auth/cookie-session", () => ({
  getCookieSessionUserId: vi.fn(),
}));
vi.mock("@/server/modules/auth/sessions", () => ({
  resolveBearerSession: vi.fn(),
}));

const USER_ID = "user-1";
const TOKEN_USER_ID = "user-2";
const SESSION_ID = "session-1";
const ACCESS_TOKEN = "header.payload.signature";

const requestWith = (headers: Record<string, string> = {}): Request =>
  new Request("http://localhost/api/v1/me", { headers });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCookieSessionUserId).mockResolvedValue(null);
  vi.mocked(resolveBearerSession).mockResolvedValue(null);
});

describe("resolvePrincipal for a browser session", () => {
  it("names the session's user for a cookie caller", async () => {
    // Arrange
    vi.mocked(getCookieSessionUserId).mockResolvedValue(USER_ID);

    // Act
    const resolution = await resolvePrincipal({
      request: requestWith(),
      transport: "http",
    });

    // Assert
    expect(resolution).toEqual({
      kind: "principal",
      principal: { userId: USER_ID, sessionId: null, via: "cookie" },
    });
    expect(resolveBearerSession).not.toHaveBeenCalled();
  });

  it("marks a call made by a server component as in-process", async () => {
    // Arrange
    vi.mocked(getCookieSessionUserId).mockResolvedValue(USER_ID);

    // Act
    const resolution = await resolvePrincipal({
      request: requestWith(),
      transport: "in-process",
    });

    // Assert
    expect(resolution).toEqual({
      kind: "principal",
      principal: { userId: USER_ID, sessionId: null, via: "in-process" },
    });
  });

  it("never reads a bearer token for an in-process call", async () => {
    // Arrange
    vi.mocked(getCookieSessionUserId).mockResolvedValue(USER_ID);
    vi.mocked(resolveBearerSession).mockResolvedValue({
      userId: TOKEN_USER_ID,
      sessionId: SESSION_ID,
    });

    // Act
    const resolution = await resolvePrincipal({
      request: requestWith({ authorization: `Bearer ${ACCESS_TOKEN}` }),
      transport: "in-process",
    });

    // Assert
    expect(resolution).toEqual({
      kind: "principal",
      principal: { userId: USER_ID, sessionId: null, via: "in-process" },
    });
    expect(resolveBearerSession).not.toHaveBeenCalled();
  });

  it("is anonymous without a session", async () => {
    // Act
    const resolution = await resolvePrincipal({
      request: requestWith(),
      transport: "http",
    });

    // Assert
    expect(resolution).toEqual({ kind: "anonymous" });
  });
});

describe("resolvePrincipal for a bearer token", () => {
  it("names the token's user and session", async () => {
    // Arrange
    vi.mocked(resolveBearerSession).mockResolvedValue({
      userId: TOKEN_USER_ID,
      sessionId: SESSION_ID,
    });

    // Act
    const resolution = await resolvePrincipal({
      request: requestWith({ authorization: `Bearer ${ACCESS_TOKEN}` }),
      transport: "http",
    });

    // Assert
    expect(resolveBearerSession).toHaveBeenCalledExactlyOnceWith(ACCESS_TOKEN);
    expect(resolution).toEqual({
      kind: "principal",
      principal: {
        userId: TOKEN_USER_ID,
        sessionId: SESSION_ID,
        via: "bearer",
      },
    });
  });

  it("lets the token win over a browser session of another user", async () => {
    // Arrange
    vi.mocked(getCookieSessionUserId).mockResolvedValue(USER_ID);
    vi.mocked(resolveBearerSession).mockResolvedValue({
      userId: TOKEN_USER_ID,
      sessionId: SESSION_ID,
    });

    // Act
    const resolution = await resolvePrincipal({
      request: requestWith({ authorization: `Bearer ${ACCESS_TOKEN}` }),
      transport: "http",
    });

    // Assert
    expect(resolution).toMatchObject({
      principal: { userId: TOKEN_USER_ID, via: "bearer" },
    });
    expect(getCookieSessionUserId).not.toHaveBeenCalled();
  });

  it("accepts the scheme in any letter case", async () => {
    // Arrange
    vi.mocked(resolveBearerSession).mockResolvedValue({
      userId: TOKEN_USER_ID,
      sessionId: SESSION_ID,
    });

    // Act
    const resolution = await resolvePrincipal({
      request: requestWith({ authorization: `bearer ${ACCESS_TOKEN}` }),
      transport: "http",
    });

    // Assert
    expect(resolution.kind).toBe("principal");
  });

  it("rejects a token that is not accepted, and does not fall back to the cookie", async () => {
    // Arrange: a valid browser session is present too.
    vi.mocked(getCookieSessionUserId).mockResolvedValue(USER_ID);

    // Act
    const resolution = await resolvePrincipal({
      request: requestWith({ authorization: `Bearer ${ACCESS_TOKEN}` }),
      transport: "http",
    });

    // Assert
    expect(resolution).toEqual({ kind: "rejected", reason: "invalid_token" });
    expect(getCookieSessionUserId).not.toHaveBeenCalled();
  });

  it.each([
    ["an empty bearer", "Bearer "],
    ["a bearer with two tokens", "Bearer one two"],
    ["another scheme", "Basic dXNlcjpwYXNz"],
    ["an empty header", ""],
  ])(
    "rejects %s without checking a token or the cookie",
    async (_case, value) => {
      // Arrange: a valid browser session is present too.
      vi.mocked(getCookieSessionUserId).mockResolvedValue(USER_ID);

      // Act
      const resolution = await resolvePrincipal({
        request: requestWith({ authorization: value }),
        transport: "http",
      });

      // Assert
      expect(resolution).toEqual({
        kind: "rejected",
        reason: "unsupported_authorization",
      });
      expect(resolveBearerSession).not.toHaveBeenCalled();
      expect(getCookieSessionUserId).not.toHaveBeenCalled();
    }
  );
});
