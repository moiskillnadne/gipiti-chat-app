import type { JWT } from "next-auth/jwt";
import { beforeEach, describe, expect, it, vi } from "vitest";

type SignedInUser = {
  id: string;
  type: "regular";
  emailVerified: boolean;
  hasActiveSubscription: boolean;
  isTester: boolean;
};

type JwtCallbackParams = {
  token: JWT;
  user?: SignedInUser;
  trigger?: "signIn" | "signUp" | "update";
  session?: unknown;
};

type CapturedAuthConfig = {
  callbacks: {
    jwt: (params: JwtCallbackParams) => Promise<JWT | null>;
  };
};

const {
  captured,
  getActiveUserSubscriptionMock,
  getUserByEmailMock,
  getTokenVersionForNewSessionMock,
  isSessionVersionCurrentMock,
} = vi.hoisted(() => ({
  captured: { config: undefined as CapturedAuthConfig | undefined },
  getActiveUserSubscriptionMock: vi.fn(),
  getUserByEmailMock: vi.fn(),
  getTokenVersionForNewSessionMock: vi.fn(),
  isSessionVersionCurrentMock: vi.fn(),
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
vi.mock("@/server/modules/auth/secret", () => ({
  getAuthSecret: () => "test-auth-secret",
}));
vi.mock("@/lib/db/query/subscription/get-active-user-subscription", () => ({
  getActiveUserSubscription: getActiveUserSubscriptionMock,
}));
vi.mock("@/server/modules/users/queries/get-by-email", () => ({
  getUserByEmail: getUserByEmailMock,
}));
vi.mock("@/server/modules/auth/token-version", () => ({
  getTokenVersionForNewSession: getTokenVersionForNewSessionMock,
  isSessionVersionCurrent: isSessionVersionCurrentMock,
}));

import "@/server/modules/auth/next-auth";

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

const runJwtCallback = (params: JwtCallbackParams): Promise<JWT | null> => {
  if (!captured.config) {
    throw new Error("next-auth.ts did not call NextAuth()");
  }
  return captured.config.callbacks.jwt(params);
};

/** For the tests of a session that is still valid: the token, never null. */
const runJwtCallbackOnLiveSession = async (
  params: JwtCallbackParams
): Promise<JWT> => {
  const token = await runJwtCallback(params);
  if (!token) {
    throw new Error("the jwt callback ended a session that should be alive");
  }
  return token;
};

beforeEach(() => {
  getTokenVersionForNewSessionMock.mockReset().mockResolvedValue(0);
  isSessionVersionCurrentMock.mockReset().mockResolvedValue(true);
});

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
    const token = await runJwtCallbackOnLiveSession({
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
    const token = await runJwtCallbackOnLiveSession({
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
    const token = await runJwtCallbackOnLiveSession({
      token: buildToken({ emailVerified: true }),
    });

    // Assert
    expect(getActiveUserSubscriptionMock).not.toHaveBeenCalled();
    expect(getUserByEmailMock).not.toHaveBeenCalled();
    expect(token.emailVerified).toBe(true);
    expect(consoleLogSpy).not.toHaveBeenCalled();
  });
});

describe("auth jwt callback and the token version", () => {
  const signedInUser: SignedInUser = {
    id: USER_ID,
    type: "regular",
    emailVerified: true,
    hasActiveSubscription: false,
    isTester: false,
  };

  it("records the account's version, as the database has it, in a new session", async () => {
    // Arrange
    getTokenVersionForNewSessionMock.mockResolvedValue(3);

    // Act
    const token = await runJwtCallbackOnLiveSession({
      token: { email: USER_EMAIL } as JWT,
      user: signedInUser,
      trigger: "signIn",
    });

    // Assert
    expect(getTokenVersionForNewSessionMock).toHaveBeenCalledWith(USER_ID);
    expect(token.ver).toBe(3);
    // A session being issued is not checked against itself.
    expect(isSessionVersionCurrentMock).not.toHaveBeenCalled();
  });

  it("keeps a session whose version is still current", async () => {
    // Arrange
    const sessionToken = buildToken({ ver: 3 });

    // Act
    const token = await runJwtCallback({ token: sessionToken });

    // Assert
    expect(isSessionVersionCurrentMock).toHaveBeenCalledWith(sessionToken);
    expect(token).toBe(sessionToken);
  });

  it("ends a session issued under an older version", async () => {
    // Arrange
    isSessionVersionCurrentMock.mockResolvedValue(false);

    // Act
    const token = await runJwtCallback({ token: buildToken({ ver: 2 }) });

    // Assert
    expect(token).toBeNull();
  });

  it("ends a stale session on an update too, before any claim is refreshed", async () => {
    // Arrange
    isSessionVersionCurrentMock.mockResolvedValue(false);

    // Act
    const token = await runJwtCallback({
      token: buildToken(),
      trigger: "update",
      session: {},
    });

    // Assert
    expect(token).toBeNull();
    expect(getUserByEmailMock).not.toHaveBeenCalled();
  });
});
