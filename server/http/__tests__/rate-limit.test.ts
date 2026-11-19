import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  getUpstashClientMock,
  limitMock,
  getRemainingMock,
  resetUsedTokensMock,
} = vi.hoisted(() => ({
  getUpstashClientMock: vi.fn(),
  limitMock: vi.fn(),
  getRemainingMock: vi.fn(),
  resetUsedTokensMock: vi.fn(),
}));

vi.mock("@/server/integrations/redis/client", () => ({
  getUpstashClient: getUpstashClientMock,
}));
vi.mock("@upstash/ratelimit", () => {
  class Ratelimit {
    static slidingWindow = (): string => "sliding-window";
    static fixedWindow = (): string => "fixed-window";
    limit = limitMock;
    getRemaining = getRemainingMock;
    resetUsedTokens = resetUsedTokensMock;
  }
  return { Ratelimit };
});

const DISABLED_WARNING = "Rate limiting is DISABLED";
const USER_EMAIL = "user@example.test";
const CLIENT_IP = "203.0.113.7";
const UNAVAILABLE = { success: false, isUnavailable: true };

// The limiters are built when the module loads, so each test imports a fresh
// copy after deciding whether an Upstash client exists.
const loadRateLimit = async (): Promise<typeof import("../rate-limit")> => {
  vi.resetModules();
  return await import("../rate-limit");
};

describe("rate limiting without an Upstash client", () => {
  beforeEach(() => {
    getUpstashClientMock.mockReset().mockReturnValue(null);
    limitMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("reports itself as disabled", async () => {
    const { isRateLimitingEnabled } = await loadRateLimit();

    expect(isRateLimitingEnabled()).toBe(false);
  });

  it("lets every request through outside production", async () => {
    // Arrange
    vi.spyOn(console, "warn").mockReturnValue(undefined);
    vi.stubEnv("VERCEL_ENV", "preview");
    const {
      checkChatRateLimit,
      checkPasswordResetRateLimit,
      checkPaymentStatusRateLimit,
      checkVerificationResendRateLimit,
    } = await loadRateLimit();

    // Act
    const results = [
      await checkChatRateLimit("user_1"),
      await checkPaymentStatusRateLimit(CLIENT_IP),
      await checkPasswordResetRateLimit(USER_EMAIL),
      await checkVerificationResendRateLimit(USER_EMAIL),
    ];

    // Assert
    expect(results).toEqual([
      { success: true },
      { success: true },
      { success: true },
      { success: true },
    ]);
  });

  it("refuses the auth flows in production and keeps chat and payment status open", async () => {
    // Arrange
    vi.spyOn(console, "warn").mockReturnValue(undefined);
    vi.stubEnv("VERCEL_ENV", "production");
    const {
      checkChatRateLimit,
      checkPasswordResetRateLimit,
      checkPaymentStatusRateLimit,
      checkVerificationResendRateLimit,
    } = await loadRateLimit();

    // Act
    const chat = await checkChatRateLimit("user_1");
    const paymentStatus = await checkPaymentStatusRateLimit(CLIENT_IP);
    const passwordReset = await checkPasswordResetRateLimit(USER_EMAIL);
    const verificationResend =
      await checkVerificationResendRateLimit(USER_EMAIL);

    // Assert
    expect(chat).toEqual({ success: true });
    expect(paymentStatus).toEqual({ success: true });
    expect(passwordReset).toEqual(UNAVAILABLE);
    expect(verificationResend).toEqual(UNAVAILABLE);
  });

  it("warns once, however many checks run", async () => {
    // Arrange
    const consoleWarnSpy = vi.spyOn(console, "warn").mockReturnValue(undefined);
    const {
      checkChatRateLimit,
      checkPasswordResetRateLimit,
      checkPaymentStatusRateLimit,
      checkVerificationResendRateLimit,
    } = await loadRateLimit();

    // Act
    await checkChatRateLimit("user_1");
    await checkChatRateLimit("user_1");
    await checkPasswordResetRateLimit(USER_EMAIL);
    await checkVerificationResendRateLimit(USER_EMAIL);
    await checkPaymentStatusRateLimit(CLIENT_IP);

    // Assert
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining(DISABLED_WARNING)
    );
  });
});

describe("rate limiting with an Upstash client", () => {
  beforeEach(() => {
    getUpstashClientMock.mockReset().mockReturnValue({});
    limitMock
      .mockReset()
      .mockResolvedValue({ success: false, remaining: 0, reset: 1 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("reports itself as enabled and enforces the limit without warning", async () => {
    // Arrange
    const consoleWarnSpy = vi.spyOn(console, "warn").mockReturnValue(undefined);
    const { checkChatRateLimit, isRateLimitingEnabled } = await loadRateLimit();

    // Act
    const result = await checkChatRateLimit("user_1");

    // Assert
    expect(isRateLimitingEnabled()).toBe(true);
    expect(result).toEqual({ success: false, remaining: 0, reset: 1 });
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it("keys the email limiters on the lower-cased address", async () => {
    // Arrange
    const { checkPasswordResetRateLimit } = await loadRateLimit();

    // Act
    await checkPasswordResetRateLimit("User@Example.Test");

    // Assert
    expect(limitMock).toHaveBeenCalledWith(USER_EMAIL);
  });

  it("lets every request through outside production when the check throws", async () => {
    // Arrange
    vi.spyOn(console, "error").mockReturnValue(undefined);
    vi.stubEnv("VERCEL_ENV", "preview");
    limitMock.mockRejectedValue(new Error("Upstash is down"));
    const { checkChatRateLimit, checkPasswordResetRateLimit } =
      await loadRateLimit();

    // Act
    const chat = await checkChatRateLimit("user_1");
    const passwordReset = await checkPasswordResetRateLimit(USER_EMAIL);

    // Assert
    expect(chat).toEqual({ success: true });
    expect(passwordReset).toEqual({ success: true });
  });

  it("refuses the auth flows in production when the check throws", async () => {
    // Arrange
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockReturnValue(undefined);
    vi.stubEnv("VERCEL_ENV", "production");
    limitMock.mockRejectedValue(new Error("Upstash is down"));
    const {
      checkChatRateLimit,
      checkPasswordResetRateLimit,
      checkPaymentStatusRateLimit,
      checkVerificationResendRateLimit,
    } = await loadRateLimit();

    // Act
    const chat = await checkChatRateLimit("user_1");
    const paymentStatus = await checkPaymentStatusRateLimit(CLIENT_IP);
    const passwordReset = await checkPasswordResetRateLimit(USER_EMAIL);
    const verificationResend =
      await checkVerificationResendRateLimit(USER_EMAIL);

    // Assert
    expect(chat).toEqual({ success: true });
    expect(paymentStatus).toEqual({ success: true });
    expect(passwordReset).toEqual(UNAVAILABLE);
    expect(verificationResend).toEqual(UNAVAILABLE);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(4);
  });
});

describe("login and sign-up limits", () => {
  const IPV6_CLIENT = "2001:db8:1:2:3:4:5:6";
  const IPV6_NETWORK_KEY = "2001:db8:1:2::/64";
  const identity = { email: " User@Example.Test ", ip: CLIENT_IP };
  const PAIR_KEY = `${USER_EMAIL}|${CLIENT_IP}`;
  const TOKENS_LEFT = { remaining: 3, reset: 1, limit: 10 };
  const NO_TOKENS_LEFT = { remaining: 0, reset: 1, limit: 10 };

  beforeEach(() => {
    getUpstashClientMock.mockReset().mockReturnValue({});
    limitMock
      .mockReset()
      .mockResolvedValue({ success: true, remaining: 9, reset: 1 });
    getRemainingMock.mockReset().mockResolvedValue(TOKENS_LEFT);
    resetUsedTokensMock.mockReset().mockResolvedValue(undefined);
    vi.stubEnv("VERCEL_ENV", "production");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it.each([
    ["locally", ""],
    ["on a Vercel development environment", "development"],
  ])("does not limit or count anything %s", async (_label, vercelEnv) => {
    // Arrange
    vi.stubEnv("VERCEL_ENV", vercelEnv);
    limitMock.mockResolvedValue({ success: false, remaining: 0, reset: 1 });
    getRemainingMock.mockResolvedValue(NO_TOKENS_LEFT);
    const {
      beginLoginAttempt,
      checkRegisterRateLimit,
      recordFailedLogin,
      recordSuccessfulLogin,
    } = await loadRateLimit();

    // Act
    const attempt = await beginLoginAttempt(identity);
    await recordFailedLogin(identity);
    await recordSuccessfulLogin(identity);
    const signUp = await checkRegisterRateLimit(CLIENT_IP);

    // Assert
    expect(attempt).toEqual({
      isAllowed: true,
      isUnavailable: false,
      shouldDelay: false,
    });
    expect(signUp).toEqual({ success: true });
    expect(limitMock).not.toHaveBeenCalled();
    expect(getRemainingMock).not.toHaveBeenCalled();
    expect(resetUsedTokensMock).not.toHaveBeenCalled();
  });

  it("applies on a preview deployment", async () => {
    // Arrange
    vi.stubEnv("VERCEL_ENV", "preview");
    limitMock.mockResolvedValue({ success: false, remaining: 0, reset: 1 });
    const { beginLoginAttempt } = await loadRateLimit();

    // Act
    const attempt = await beginLoginAttempt(identity);

    // Assert
    expect(attempt.isAllowed).toBe(false);
  });

  it("counts the attempt for the account and address and only looks at the other two limits", async () => {
    // Arrange
    const { beginLoginAttempt } = await loadRateLimit();

    // Act
    const attempt = await beginLoginAttempt(identity);

    // Assert
    expect(attempt).toEqual({
      isAllowed: true,
      isUnavailable: false,
      shouldDelay: false,
    });
    expect(limitMock).toHaveBeenCalledTimes(1);
    expect(limitMock).toHaveBeenCalledWith(PAIR_KEY);
    expect(getRemainingMock).toHaveBeenCalledTimes(2);
    expect(getRemainingMock).toHaveBeenCalledWith(CLIENT_IP);
    expect(getRemainingMock).toHaveBeenCalledWith(USER_EMAIL);
  });

  it("refuses when the account and address limit is reached", async () => {
    // Arrange
    limitMock.mockResolvedValue({ success: false, remaining: 0, reset: 1 });
    const { beginLoginAttempt } = await loadRateLimit();

    // Act
    const attempt = await beginLoginAttempt(identity);

    // Assert
    expect(attempt).toEqual({
      isAllowed: false,
      isUnavailable: false,
      shouldDelay: false,
    });
  });

  it("refuses when the address has no failed logins left", async () => {
    // Arrange
    getRemainingMock.mockImplementation((key: string) =>
      Promise.resolve(key === CLIENT_IP ? NO_TOKENS_LEFT : TOKENS_LEFT)
    );
    const { beginLoginAttempt } = await loadRateLimit();

    // Act
    const attempt = await beginLoginAttempt(identity);

    // Assert
    expect(attempt.isAllowed).toBe(false);
    expect(attempt.shouldDelay).toBe(false);
  });

  it("delays but allows when the account has no failed logins left", async () => {
    // Arrange
    getRemainingMock.mockImplementation((key: string) =>
      Promise.resolve(key === USER_EMAIL ? NO_TOKENS_LEFT : TOKENS_LEFT)
    );
    const { beginLoginAttempt } = await loadRateLimit();

    // Act
    const attempt = await beginLoginAttempt(identity);

    // Assert
    expect(attempt).toEqual({
      isAllowed: true,
      isUnavailable: false,
      shouldDelay: true,
    });
  });

  it("keys an IPv6 client by its /64 network", async () => {
    // Arrange
    const { beginLoginAttempt } = await loadRateLimit();

    // Act
    await beginLoginAttempt({ email: USER_EMAIL, ip: IPV6_CLIENT });

    // Assert
    expect(limitMock).toHaveBeenCalledWith(`${USER_EMAIL}|${IPV6_NETWORK_KEY}`);
    expect(getRemainingMock).toHaveBeenCalledWith(IPV6_NETWORK_KEY);
  });

  it("limits by account alone when the platform reported no address", async () => {
    // Arrange
    const { beginLoginAttempt } = await loadRateLimit();

    // Act
    const attempt = await beginLoginAttempt({ email: USER_EMAIL, ip: null });

    // Assert
    expect(attempt.isAllowed).toBe(true);
    expect(limitMock).toHaveBeenCalledWith(`${USER_EMAIL}|unknown`);
    expect(getRemainingMock).toHaveBeenCalledTimes(1);
    expect(getRemainingMock).toHaveBeenCalledWith(USER_EMAIL);
  });

  it("refuses in production when the limiter cannot be checked", async () => {
    // Arrange
    vi.spyOn(console, "error").mockReturnValue(undefined);
    limitMock.mockRejectedValue(new Error("Upstash is down"));
    getRemainingMock.mockRejectedValue(new Error("Upstash is down"));
    const { beginLoginAttempt, checkRegisterRateLimit } = await loadRateLimit();

    // Act
    const attempt = await beginLoginAttempt(identity);
    const signUp = await checkRegisterRateLimit(CLIENT_IP);

    // Assert
    expect(attempt).toEqual({
      isAllowed: false,
      isUnavailable: true,
      shouldDelay: false,
    });
    expect(signUp).toEqual(UNAVAILABLE);
  });

  it("lets a login through on a preview when the limiter cannot be checked", async () => {
    // Arrange
    vi.spyOn(console, "error").mockReturnValue(undefined);
    vi.stubEnv("VERCEL_ENV", "preview");
    limitMock.mockRejectedValue(new Error("Upstash is down"));
    getRemainingMock.mockRejectedValue(new Error("Upstash is down"));
    const { beginLoginAttempt } = await loadRateLimit();

    // Act
    const attempt = await beginLoginAttempt(identity);

    // Assert
    expect(attempt).toEqual({
      isAllowed: true,
      isUnavailable: false,
      shouldDelay: false,
    });
  });

  it("counts a failed login against the address and the account, not the pair", async () => {
    // Arrange
    const { recordFailedLogin } = await loadRateLimit();

    // Act
    await recordFailedLogin(identity);

    // Assert
    expect(limitMock).toHaveBeenCalledTimes(2);
    expect(limitMock).toHaveBeenCalledWith(CLIENT_IP);
    expect(limitMock).toHaveBeenCalledWith(USER_EMAIL);
  });

  it("does not throw when counting a failed login fails", async () => {
    // Arrange
    vi.spyOn(console, "error").mockReturnValue(undefined);
    limitMock.mockRejectedValue(new Error("Upstash is down"));
    const { recordFailedLogin } = await loadRateLimit();

    // Act
    const recording = recordFailedLogin(identity);

    // Assert
    await expect(recording).resolves.toBeUndefined();
  });

  it("gives the account and address limit back after a successful login", async () => {
    // Arrange
    const { recordSuccessfulLogin } = await loadRateLimit();

    // Act
    await recordSuccessfulLogin(identity);

    // Assert
    expect(resetUsedTokensMock).toHaveBeenCalledTimes(1);
    expect(resetUsedTokensMock).toHaveBeenCalledWith(PAIR_KEY);
    expect(limitMock).not.toHaveBeenCalled();
  });

  it("does not throw when the reset after a successful login fails", async () => {
    // Arrange
    vi.spyOn(console, "error").mockReturnValue(undefined);
    resetUsedTokensMock.mockRejectedValue(new Error("Upstash is down"));
    const { recordSuccessfulLogin } = await loadRateLimit();

    // Act
    const recording = recordSuccessfulLogin(identity);

    // Assert
    await expect(recording).resolves.toBeUndefined();
  });

  it("limits sign-ups by address, an IPv6 client by its /64", async () => {
    // Arrange
    limitMock.mockResolvedValue({ success: false, remaining: 0, reset: 1 });
    const { checkRegisterRateLimit } = await loadRateLimit();

    // Act
    const signUp = await checkRegisterRateLimit(IPV6_CLIENT);

    // Assert
    expect(signUp).toEqual({ success: false, remaining: 0, reset: 1 });
    expect(limitMock).toHaveBeenCalledWith(IPV6_NETWORK_KEY);
  });

  it("allows a sign-up when the platform reported no address", async () => {
    // Arrange
    const { checkRegisterRateLimit } = await loadRateLimit();

    // Act
    const signUp = await checkRegisterRateLimit(null);

    // Assert
    expect(signUp).toEqual({ success: true });
    expect(limitMock).not.toHaveBeenCalled();
  });
});
