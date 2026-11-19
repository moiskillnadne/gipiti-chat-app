import { describe, expect, it, vi } from "vitest";

import type { CookieSession } from "@/server/api/_kit/context";
import { resolvePrincipal } from "@/server/api/_kit/guards/principal";

const USER_ID = "user-1";

const requestWith = (headers: Record<string, string> = {}): Request =>
  new Request("http://localhost/api/v1/me", { headers });

const sessionReader = (session: CookieSession | null) =>
  vi.fn<() => Promise<CookieSession | null>>().mockResolvedValue(session);

describe("resolvePrincipal", () => {
  it("names the browser session's user for a cookie caller", async () => {
    // Arrange
    const getCookieSession = sessionReader({ userId: USER_ID });

    // Act
    const resolution = await resolvePrincipal({
      request: requestWith(),
      transport: "http",
      getCookieSession,
    });

    // Assert
    expect(resolution).toEqual({
      kind: "principal",
      principal: { userId: USER_ID, sessionId: null, via: "cookie" },
    });
  });

  it("marks a call made by a server component as in-process", async () => {
    // Act
    const resolution = await resolvePrincipal({
      request: requestWith(),
      transport: "in-process",
      getCookieSession: sessionReader({ userId: USER_ID }),
    });

    // Assert
    expect(resolution).toEqual({
      kind: "principal",
      principal: { userId: USER_ID, sessionId: null, via: "in-process" },
    });
  });

  it("is anonymous without a session", async () => {
    // Act
    const resolution = await resolvePrincipal({
      request: requestWith(),
      transport: "http",
      getCookieSession: sessionReader(null),
    });

    // Assert
    expect(resolution).toEqual({ kind: "anonymous" });
  });

  it.each([
    ["a bearer token", "Bearer some.jwt.token"],
    ["an empty bearer", "Bearer "],
    ["another scheme", "Basic dXNlcjpwYXNz"],
  ])("rejects %s without looking at the cookie", async (_case, value) => {
    // Arrange: a valid browser session is present too.
    const getCookieSession = sessionReader({ userId: USER_ID });

    // Act
    const resolution = await resolvePrincipal({
      request: requestWith({ authorization: value }),
      transport: "http",
      getCookieSession,
    });

    // Assert
    expect(resolution).toEqual({
      kind: "rejected",
      reason: "bearer_not_supported",
    });
    expect(getCookieSession).not.toHaveBeenCalled();
  });
});
