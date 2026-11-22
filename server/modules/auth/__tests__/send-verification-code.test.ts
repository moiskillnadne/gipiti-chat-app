import { beforeEach, describe, expect, it, vi } from "vitest";

import type { User } from "@/server/db/schema";
import { checkVerificationResendRateLimit } from "@/server/http/rate-limit";
import { sendVerificationCode } from "@/server/modules/auth/send-verification-code";
import { sendVerificationEmail } from "@/server/modules/email/send-verification-email";
import { getUserByEmail } from "@/server/modules/users/queries/get-by-email";

vi.mock("@/server/http/rate-limit", () => ({
  checkVerificationResendRateLimit: vi.fn(),
}));
vi.mock("@/server/modules/email/send-verification-email", () => ({
  sendVerificationEmail: vi.fn(),
}));
vi.mock("@/server/modules/users/queries/get-by-email", () => ({
  getUserByEmail: vi.fn(),
}));

const EMAIL = "user@example.test";
const RESET_AT = 1_900_000_000_000;

const userRow = (overrides: Partial<User> = {}): User =>
  ({ id: "user-1", email: EMAIL, emailVerified: false, ...overrides }) as User;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(checkVerificationResendRateLimit).mockResolvedValue({
    success: true,
  });
  vi.mocked(getUserByEmail).mockResolvedValue(userRow());
  vi.mocked(sendVerificationEmail).mockResolvedValue({ success: true });
});

describe("sendVerificationCode", () => {
  it("sends a code to an unverified account", async () => {
    // Act
    const result = await sendVerificationCode({ email: EMAIL });

    // Assert
    expect(result).toEqual({ status: "sent" });
    expect(sendVerificationEmail).toHaveBeenCalledExactlyOnceWith({
      email: EMAIL,
    });
  });

  it("answers rate_limited with the reset time and looks nothing up", async () => {
    // Arrange
    vi.mocked(checkVerificationResendRateLimit).mockResolvedValue({
      success: false,
      reset: RESET_AT,
    });

    // Act
    const result = await sendVerificationCode({ email: EMAIL });

    // Assert
    expect(result).toEqual({ status: "rate_limited", resetAt: RESET_AT });
    expect(getUserByEmail).not.toHaveBeenCalled();
  });

  it("answers limiter_unavailable when the limit cannot be checked", async () => {
    // Arrange
    vi.mocked(checkVerificationResendRateLimit).mockResolvedValue({
      success: false,
      isUnavailable: true,
    });

    // Act
    const result = await sendVerificationCode({ email: EMAIL });

    // Assert
    expect(result).toEqual({ status: "limiter_unavailable" });
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });

  it.each<[string, User | null, string]>([
    ["no account has the email", null, "unknown_user"],
    [
      "the email is verified already",
      userRow({ emailVerified: true }),
      "already_verified",
    ],
  ])("sends nothing when %s", async (_case, foundUser, expectedStatus) => {
    // Arrange
    vi.mocked(getUserByEmail).mockResolvedValue(foundUser);

    // Act
    const result = await sendVerificationCode({ email: EMAIL });

    // Assert
    expect(result).toEqual({ status: expectedStatus });
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("answers send_failed when the sender reports a failure", async () => {
    // Arrange
    vi.spyOn(console, "error").mockReturnValue(undefined);
    vi.mocked(sendVerificationEmail).mockResolvedValue({
      success: false,
      error: "provider down",
    });

    // Act
    const result = await sendVerificationCode({ email: EMAIL });

    // Assert
    expect(result).toEqual({ status: "send_failed" });
  });
});
