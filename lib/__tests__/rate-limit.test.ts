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
  });

  it("reports itself as disabled", async () => {
    const { isRateLimitingEnabled } = await loadRateLimit();

    expect(isRateLimitingEnabled()).toBe(false);
  });

  it("still lets requests through (fail-open is unchanged)", async () => {
    vi.spyOn(console, "warn").mockReturnValue(undefined);
    const { checkChatRateLimit, checkPasswordResetRateLimit } =
      await loadRateLimit();

    expect(await checkChatRateLimit("user_1")).toEqual({ success: true });
    expect(await checkPasswordResetRateLimit("user@example.test")).toEqual({
      success: true,
    });
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
    await checkPasswordResetRateLimit("user@example.test");
    await checkVerificationResendRateLimit("user@example.test");
    await checkPaymentStatusRateLimit("203.0.113.7");

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
});
