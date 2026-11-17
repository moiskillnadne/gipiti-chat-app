import { beforeEach, describe, expect, it, vi } from "vitest";

import { authConfig } from "@/app/(auth)/auth.config";

type SignInOptions = { email: string; password: string; redirect: boolean };

const { signInMock } = vi.hoisted(() => ({
  signInMock:
    vi.fn<(provider: string, options: SignInOptions) => Promise<string>>(),
}));

// With `redirect: false` the server `signIn` of Auth.js resolves with a URL
// string, and it does so for some failures too. These tests cover what `login`
// makes of that string. Every URL below was captured from the real `signIn`
// (next-auth 5.0.0-beta.32, @auth/core 0.41.3) with this app's `pages` config.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/connection", () => ({ db: {} }));
vi.mock("@/app/(auth)/auth", () => ({ signIn: signInMock }));
vi.mock("next/headers", () => ({ cookies: vi.fn(), headers: vi.fn() }));
vi.mock("@/lib/flags", () => ({ isSignupEnabled: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({}));
vi.mock("@/lib/db/query/user/get-by-email", () => ({
  getUserByEmail: vi.fn(),
}));
vi.mock("@/lib/db/query/user/set-password-reset-token", () => ({
  setPasswordResetToken: vi.fn(),
}));
vi.mock("@/lib/email/send-verification-email", () => ({
  sendVerificationEmail: vi.fn(),
}));
vi.mock("@/lib/email/send-password-reset", () => ({
  sendPasswordResetEmail: vi.fn(),
}));
vi.mock("@/lib/email/send-password-changed", () => ({
  sendPasswordChangedEmail: vi.fn(),
}));

import { login } from "@/app/(auth)/actions";

const ORIGIN = "http://localhost:3000";

const credentialsForm = (): FormData => {
  const data = new FormData();
  data.set("email", "user@example.test");
  data.set("password", "Str0ng!Password");
  return data;
};

describe("login when signIn resolves with a URL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each<[string, string]>([
    [
      // An error that is not an AuthError, thrown outside the credentials
      // callback (for example while Auth.js prepares the request).
      "the Auth.js error page",
      `${ORIGIN}/api/auth/error?error=Configuration`,
    ],
    [
      // Auth.js refused the request before running `authorize` (untrusted
      // host, a broken `authjs.callback-url` cookie) or was sent an
      // `X-Auth-Return-Redirect` header: its answer has no `Location`, so
      // `signIn` falls back to the URL it posted to.
      "the credentials callback endpoint itself",
      `${ORIGIN}/api/auth/callback/credentials?`,
    ],
  ])(
    "returns failed for %s, where no session was created",
    async (_label, url) => {
      // Arrange
      signInMock.mockResolvedValue(url);

      // Act
      const state = await login({ status: "idle" }, credentialsForm());

      // Assert
      expect(state).toEqual({ status: "failed" });
    }
  );

  it.each<[string, string]>([
    ["the login page it was posted from", `${ORIGIN}/login`],
    [
      "the login page with the callbackUrl the proxy added",
      `${ORIGIN}/login?callbackUrl=${encodeURIComponent(`${ORIGIN}/chat`)}`,
    ],
    ["the site root, when the request had no Referer", `${ORIGIN}/`],
    [
      // The session cookie is set in this case too: the query string is the
      // page's own and says nothing about the sign-in.
      "a login page URL that carries an error parameter",
      `${ORIGIN}/login?error=foo`,
    ],
    [
      "a login page whose callbackUrl points at an Auth.js route",
      `${ORIGIN}/login?callbackUrl=${encodeURIComponent(`${ORIGIN}/api/auth/session`)}`,
    ],
  ])("returns success for %s", async (_label, url) => {
    // Arrange
    signInMock.mockResolvedValue(url);

    // Act
    const state = await login({ status: "idle" }, credentialsForm());

    // Assert
    expect(state).toEqual({ status: "success" });
  });

  it("can rely on Auth.js keeping its error page under /api/auth", () => {
    // `login` recognises a failed sign-in by the returned URL pointing into
    // the Auth.js routes. A custom `pages.error` would move the error page
    // out of there: teach `login` about the new path before adding one.
    expect(authConfig.pages).not.toHaveProperty("error");
  });
});
