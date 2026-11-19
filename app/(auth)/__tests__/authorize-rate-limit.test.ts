import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LoginAttemptDecision, LoginIdentity } from "@/lib/rate-limit";
import type { User } from "@/server/db/schema";

type CredentialsInput = { email: string; password: string };

type CredentialsProviderOptions = {
  authorize: (
    credentials: CredentialsInput,
    request?: Request
  ) => Promise<{ id: string } | null>;
};

type CapturedAuthConfig = { providers: CredentialsProviderOptions[] };

const {
  captured,
  compareMock,
  getUserByEmailMock,
  beginLoginAttemptMock,
  recordFailedLoginMock,
  recordSuccessfulLoginMock,
} = vi.hoisted(() => ({
  captured: { config: undefined as CapturedAuthConfig | undefined },
  compareMock: vi.fn<(password: string, hash: string) => Promise<boolean>>(),
  getUserByEmailMock: vi.fn<(email: string) => Promise<User | null>>(),
  beginLoginAttemptMock:
    vi.fn<(identity: LoginIdentity) => Promise<LoginAttemptDecision>>(),
  recordFailedLoginMock: vi.fn<(identity: LoginIdentity) => Promise<void>>(),
  recordSuccessfulLoginMock:
    vi.fn<(identity: LoginIdentity) => Promise<void>>(),
}));

// NextAuth() is replaced by a stub that keeps the config it was called with,
// so the real `authorize` from the auth module can be invoked directly.
vi.mock("next-auth", () => ({
  default: (config: CapturedAuthConfig) => {
    captured.config = config;
    return { handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() };
  },
  CredentialsSignin: class CredentialsSignin extends Error {
    code = "credentials";
  },
}));
vi.mock("next-auth/providers/credentials", () => ({
  default: (options: CredentialsProviderOptions) => options,
}));
vi.mock("@/lib/auth/secret", () => ({
  getAuthSecret: () => "test-auth-secret",
}));
vi.mock("bcrypt-ts", async () => {
  const actual = await vi.importActual<typeof import("bcrypt-ts")>("bcrypt-ts");
  return { ...actual, compare: compareMock };
});
vi.mock("@/lib/db/query/subscription/get-active-user-subscription", () => ({
  getActiveUserSubscription: () => Promise.resolve(null),
}));
vi.mock("@/lib/db/query/user/get-by-email", () => ({
  getUserByEmail: getUserByEmailMock,
}));
vi.mock("@/lib/rate-limit", () => ({
  beginLoginAttempt: beginLoginAttemptMock,
  recordFailedLogin: recordFailedLoginMock,
  recordSuccessfulLogin: recordSuccessfulLoginMock,
}));

await import("@/app/(auth)/auth");

const USER_EMAIL = "user@example.test";
const PASSWORD = "typed-password";
const CLIENT_IP = "203.0.113.7";
const THROTTLED_LOGIN_DELAY_MS = 2000;

const ALLOWED: LoginAttemptDecision = {
  isAllowed: true,
  isUnavailable: false,
  shouldDelay: false,
};

const storedUser = {
  id: "user-1",
  email: USER_EMAIL,
  password: "stored-password-hash",
  emailVerified: true,
  isTester: false,
} as User;

const loginRequest = (): Request =>
  new Request("http://localhost/api/auth/callback/credentials", {
    method: "POST",
    headers: { "x-forwarded-for": CLIENT_IP },
  });

const runAuthorize = (request?: Request): Promise<{ id: string } | null> => {
  const provider = captured.config?.providers[0];
  if (!provider) {
    throw new Error("The auth module did not register a credentials provider");
  }
  return provider.authorize({ email: USER_EMAIL, password: PASSWORD }, request);
};

describe("credentials authorize and the login limits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    beginLoginAttemptMock.mockResolvedValue(ALLOWED);
    recordFailedLoginMock.mockResolvedValue(undefined);
    recordSuccessfulLoginMock.mockResolvedValue(undefined);
    getUserByEmailMock.mockResolvedValue(storedUser);
    compareMock.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("asks the limiter with the typed email and the client address", async () => {
    // Act
    await runAuthorize(loginRequest());

    // Assert
    expect(beginLoginAttemptMock).toHaveBeenCalledTimes(1);
    expect(beginLoginAttemptMock).toHaveBeenCalledWith({
      email: USER_EMAIL,
      ip: CLIENT_IP,
    });
  });

  it("uses no address when it is called without a request", async () => {
    // Act
    await runAuthorize();

    // Assert
    expect(beginLoginAttemptMock).toHaveBeenCalledWith({
      email: USER_EMAIL,
      ip: null,
    });
  });

  it("throws the rate-limit error without looking the user up when the attempt is refused", async () => {
    // Arrange
    beginLoginAttemptMock.mockResolvedValue({ ...ALLOWED, isAllowed: false });

    // Act
    const authorization = runAuthorize(loginRequest());

    // Assert
    await expect(authorization).rejects.toMatchObject({ code: "rate_limited" });
    expect(getUserByEmailMock).not.toHaveBeenCalled();
    expect(compareMock).not.toHaveBeenCalled();
    expect(recordFailedLoginMock).not.toHaveBeenCalled();
  });

  it("counts a wrong password as a failed login", async () => {
    // Arrange
    compareMock.mockResolvedValue(false);

    // Act
    const authorizedUser = await runAuthorize(loginRequest());

    // Assert
    expect(authorizedUser).toBeNull();
    expect(recordFailedLoginMock).toHaveBeenCalledTimes(1);
    expect(recordFailedLoginMock).toHaveBeenCalledWith({
      email: USER_EMAIL,
      ip: CLIENT_IP,
    });
    expect(recordSuccessfulLoginMock).not.toHaveBeenCalled();
  });

  it("counts an unknown email as a failed login", async () => {
    // Arrange
    getUserByEmailMock.mockResolvedValue(null);

    // Act
    const authorizedUser = await runAuthorize(loginRequest());

    // Assert
    expect(authorizedUser).toBeNull();
    expect(recordFailedLoginMock).toHaveBeenCalledTimes(1);
  });

  it("gives the limit back after a correct password", async () => {
    // Act
    const authorizedUser = await runAuthorize(loginRequest());

    // Assert
    expect(authorizedUser).toMatchObject({ id: storedUser.id });
    expect(recordSuccessfulLoginMock).toHaveBeenCalledTimes(1);
    expect(recordSuccessfulLoginMock).toHaveBeenCalledWith({
      email: USER_EMAIL,
      ip: CLIENT_IP,
    });
    expect(recordFailedLoginMock).not.toHaveBeenCalled();
  });

  it("holds the answer back when the account is being guessed at", async () => {
    // Arrange
    vi.useFakeTimers();
    beginLoginAttemptMock.mockResolvedValue({ ...ALLOWED, shouldDelay: true });

    // Act
    const authorization = runAuthorize(loginRequest());
    await vi.advanceTimersByTimeAsync(THROTTLED_LOGIN_DELAY_MS - 1);
    const lookupsBeforeTheDelayEnds = getUserByEmailMock.mock.calls.length;
    await vi.advanceTimersByTimeAsync(1);
    const authorizedUser = await authorization;

    // Assert
    expect(lookupsBeforeTheDelayEnds).toBe(0);
    expect(authorizedUser).toMatchObject({ id: storedUser.id });
  });
});
