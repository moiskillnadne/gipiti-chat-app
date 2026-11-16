import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getUpstashClientMock, limitMock } = vi.hoisted(() => ({
  getUpstashClientMock: vi.fn(),
  limitMock: vi.fn(),
}));

vi.mock("@/lib/redis", () => ({ getUpstashClient: getUpstashClientMock }));
vi.mock("@upstash/ratelimit", () => {
  class Ratelimit {
    static slidingWindow = (): string => "sliding-window";
    static fixedWindow = (): string => "fixed-window";
    limit = limitMock;
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
