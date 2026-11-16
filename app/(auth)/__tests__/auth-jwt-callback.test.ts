import type { JWT } from "next-auth/jwt";
import { beforeEach, describe, expect, it, vi } from "vitest";

type JwtCallbackParams = {
  token: JWT;
  trigger?: "signIn" | "signUp" | "update";
  session?: unknown;
};

type CapturedAuthConfig = {
  callbacks: {
    jwt: (params: JwtCallbackParams) => Promise<JWT>;
  };
};

const { captured, getActiveUserSubscriptionMock, getUserByEmailMock } =
  vi.hoisted(() => ({
    captured: { config: undefined as CapturedAuthConfig | undefined },
    getActiveUserSubscriptionMock: vi.fn(),
    getUserByEmailMock: vi.fn(),
  }));

// NextAuth() is replaced by a stub that keeps the config it was called with,
// so the real callbacks from auth.ts can be invoked directly.
vi.mock("next-auth", () => ({
  default: (config: CapturedAuthConfig) => {
    captured.config = config;
    return { handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() };
  },
  // The auth module extends this class for its rate-limit error.
  CredentialsSignin: class CredentialsSignin extends Error {
    code = "credentials";
  },
}));
vi.mock("next-auth/providers/credentials", () => ({
  default: (options: unknown) => options,
}));
vi.mock("@/lib/auth/secret", () => ({
  getAuthSecret: () => "test-auth-secret",
}));
vi.mock("@/lib/db/query/subscription/get-active-user-subscription", () => ({
  getActiveUserSubscription: getActiveUserSubscriptionMock,
}));
vi.mock("@/lib/db/query/user/get-by-email", () => ({
  getUserByEmail: getUserByEmailMock,
}));

import "../auth";

const USER_ID = "user_1";
const USER_EMAIL = "user@example.test";

const buildToken = (claims: Partial<JWT> = {}): JWT => ({
  id: USER_ID,
  email: USER_EMAIL,
  type: "regular",
  emailVerified: false,
  hasActiveSubscription: false,
  isTester: false,
  ...claims,
});

const runJwtCallback = (params: JwtCallbackParams): Promise<JWT> => {
  if (!captured.config) {
    throw new Error("auth.ts did not call NextAuth()");
  }
  return captured.config.callbacks.jwt(params);
};

describe("auth jwt callback on session update", () => {
  beforeEach(() => {
    getActiveUserSubscriptionMock.mockReset().mockResolvedValue(null);
    getUserByEmailMock.mockReset().mockResolvedValue({
      id: USER_ID,
      email: USER_EMAIL,
      emailVerified: false,
      isTester: false,
    });
  });

  it("ignores claims sent by the client and keeps the database values", async () => {
    // Act
    const token = await runJwtCallback({
      token: buildToken(),
      trigger: "update",
      session: {
        emailVerified: true,
        hasActiveSubscription: true,
        isTester: true,
      },
    });

    // Assert
    expect(token.emailVerified).toBe(false);
    expect(token.hasActiveSubscription).toBe(false);
    expect(token.isTester).toBe(false);
  });

  it("refreshes the claims from the database when the payload is empty", async () => {
    // Arrange
    getActiveUserSubscriptionMock.mockResolvedValue({ id: "sub_1" });
    getUserByEmailMock.mockResolvedValue({
      id: USER_ID,
      email: USER_EMAIL,
      emailVerified: true,
      isTester: true,
    });

    // Act
    const token = await runJwtCallback({
      token: buildToken(),
      trigger: "update",
      session: {},
    });

    // Assert
    expect(getActiveUserSubscriptionMock).toHaveBeenCalledWith({
      userId: USER_ID,
    });
    expect(token.emailVerified).toBe(true);
    expect(token.hasActiveSubscription).toBe(true);
    expect(token.isTester).toBe(true);
  });

  it("does not query the database or log on an ordinary token read", async () => {
    // Arrange
    const consoleLogSpy = vi.spyOn(console, "log");

    // Act
    const token = await runJwtCallback({
      token: buildToken({ emailVerified: true }),
    });

    // Assert
    expect(getActiveUserSubscriptionMock).not.toHaveBeenCalled();
    expect(getUserByEmailMock).not.toHaveBeenCalled();
    expect(token.emailVerified).toBe(true);
    expect(consoleLogSpy).not.toHaveBeenCalled();
  });
});
