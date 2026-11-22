import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getCookieSessionUserId,
  renewCookieSession,
} from "@/server/modules/auth/cookie-session";
import { auth, signIn } from "@/server/modules/auth/next-auth";

vi.mock("@/server/modules/auth/next-auth", () => ({
  auth: vi.fn(),
  signIn: vi.fn(),
}));

const EMAIL = "user@example.test";
const PASSWORD = "N3w!Password";

// `auth` and `signIn` are overloaded; the tests use the plain call forms.
const authMock = vi.mocked(auth as unknown as () => Promise<unknown>);
const signInMock = vi.mocked(signIn as unknown as () => Promise<unknown>);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getCookieSessionUserId", () => {
  it("answers the account of the browser session", async () => {
    // Arrange
    authMock.mockResolvedValue({ user: { id: "user-1" } });

    // Act and assert
    expect(await getCookieSessionUserId()).toBe("user-1");
  });

  it.each<[string, unknown]>([
    ["no session", null],
    ["a session without a user id", { user: {} }],
  ])("answers null for %s", async (_case, session) => {
    // Arrange
    authMock.mockResolvedValue(session);

    // Act and assert
    expect(await getCookieSessionUserId()).toBeNull();
  });
});

describe("renewCookieSession", () => {
  it("signs in through Auth.js without a redirect and reports a new session", async () => {
    // Arrange: a successful sign-in resolves with the page to go to.
    signInMock.mockResolvedValue("https://gipiti.test/chat");

    // Act
    const isRenewed = await renewCookieSession({
      email: EMAIL,
      password: PASSWORD,
    });

    // Assert
    expect(isRenewed).toBe(true);
    expect(signIn).toHaveBeenCalledExactlyOnceWith("credentials", {
      email: EMAIL,
      password: PASSWORD,
      redirect: false,
    });
  });

  it.each<[string, string]>([
    ["the Auth.js error page", "/api/auth/error?error=Configuration"],
    ["its own callback URL", "/api/auth/callback/credentials"],
  ])(
    "reports no session when signIn resolves with %s",
    async (_case, outcome) => {
      // Arrange: Auth.js resolved, but no session cookie was set.
      signInMock.mockResolvedValue(outcome);

      // Act and assert
      expect(
        await renewCookieSession({ email: EMAIL, password: PASSWORD })
      ).toBe(false);
    }
  );

  it("reports no session, and does not throw, when signIn throws", async () => {
    // Arrange: for example, the login limit refused the attempt.
    vi.spyOn(console, "error").mockReturnValue(undefined);
    signInMock.mockRejectedValue(new Error("CredentialsSignin"));

    // Act and assert
    expect(await renewCookieSession({ email: EMAIL, password: PASSWORD })).toBe(
      false
    );
  });
});
