import { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { proxy } from "@/proxy";
import { isSessionVersionCurrent } from "@/server/modules/auth/token-version";

vi.mock("next-auth/jwt", () => ({ getToken: vi.fn() }));
vi.mock("@/server/flags", () => ({
  isSignupEnabled: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/server/modules/auth/secret", () => ({
  getAuthSecret: () => "test-auth-secret",
}));
vi.mock("@/server/modules/auth/token-version", () => ({
  isSessionVersionCurrent: vi.fn(),
}));

const ORIGIN = "https://gipiti.test";
// Outside local development the session cookie carries the secure prefix.
const SESSION_COOKIE = "__Secure-authjs.session-token";
const sessionToken = { id: "user-1", ver: 1 };

type SessionToken = Awaited<ReturnType<typeof getToken>>;

const requestTo = (path: string, cookieHeader?: string): NextRequest =>
  new NextRequest(`${ORIGIN}${path}`, {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });

const signedInRequestTo = (path: string): NextRequest =>
  requestTo(path, `${SESSION_COOKIE}=encrypted; utm_params=kept`);

const redirectTargetOf = (response: Response): string | null => {
  const location = response.headers.get("location");
  return location ? new URL(location).pathname : null;
};

const deletedCookiesOf = (response: Response): string[] =>
  response.headers
    .getSetCookie()
    .filter((cookie) => cookie.includes("Max-Age=0"))
    .map((cookie) => cookie.split("=")[0]);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getToken).mockResolvedValue(sessionToken as SessionToken);
  vi.mocked(isSessionVersionCurrent).mockResolvedValue(true);
});

describe("proxy with a live session", () => {
  it.each<[string, string]>([
    ["the landing page", "/"],
    ["the login page", "/login"],
  ])("sends a signed-in visitor from %s to the chat", async (_case, path) => {
    // Act
    const response = await proxy(signedInRequestTo(path));

    // Assert
    expect(redirectTargetOf(response)).toBe("/chat");
    expect(deletedCookiesOf(response)).toEqual([]);
  });

  it("lets a signed-in visitor into a protected page", async () => {
    // Act
    const response = await proxy(signedInRequestTo("/chat"));

    // Assert
    expect(redirectTargetOf(response)).toBeNull();
    expect(deletedCookiesOf(response)).toEqual([]);
  });
});

describe("proxy with a session whose token version is no longer current", () => {
  beforeEach(() => {
    vi.mocked(isSessionVersionCurrent).mockResolvedValue(false);
  });

  it("sends the visitor from a protected page to the login and deletes the cookie", async () => {
    // Act
    const response = await proxy(signedInRequestTo("/chat"));

    // Assert
    expect(isSessionVersionCurrent).toHaveBeenCalledWith(sessionToken);
    expect(redirectTargetOf(response)).toBe("/login");
    expect(deletedCookiesOf(response)).toEqual([SESSION_COOKIE]);
  });

  it("shows the login page instead of bouncing back to the chat, which is what looped", async () => {
    // Act
    const response = await proxy(signedInRequestTo("/login"));

    // Assert
    expect(redirectTargetOf(response)).toBeNull();
    expect(deletedCookiesOf(response)).toEqual([SESSION_COOKIE]);
  });

  it("shows the landing page as to an anonymous visitor", async () => {
    // Act
    const response = await proxy(signedInRequestTo("/"));

    // Assert
    expect(redirectTargetOf(response)).toBeNull();
    expect(deletedCookiesOf(response)).toEqual([SESSION_COOKIE]);
  });

  it("deletes every chunk of a split session cookie, as a secure cookie", async () => {
    // Arrange
    const request = requestTo(
      "/chat",
      `${SESSION_COOKIE}.0=part; ${SESSION_COOKIE}.1=part`
    );

    // Act
    const response = await proxy(request);

    // Assert
    expect(deletedCookiesOf(response)).toEqual([
      `${SESSION_COOKIE}.0`,
      `${SESSION_COOKIE}.1`,
    ]);
    for (const cookie of response.headers.getSetCookie()) {
      expect(cookie).toContain("Secure");
      expect(cookie).toContain("Path=/");
    }
  });
});

describe("proxy without a session", () => {
  beforeEach(() => {
    vi.mocked(getToken).mockResolvedValue(null);
  });

  it("sends an anonymous visitor from a protected page to the login", async () => {
    // Act
    const response = await proxy(requestTo("/chat"));

    // Assert
    expect(redirectTargetOf(response)).toBe("/login");
    expect(isSessionVersionCurrent).not.toHaveBeenCalled();
  });

  it("does not read the session on a page where it decides nothing", async () => {
    // Act
    const response = await proxy(signedInRequestTo("/legal/terms"));

    // Assert
    expect(redirectTargetOf(response)).toBeNull();
    expect(getToken).not.toHaveBeenCalled();
    expect(isSessionVersionCurrent).not.toHaveBeenCalled();
  });
});
