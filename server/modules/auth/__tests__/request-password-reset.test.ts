import { beforeEach, describe, expect, it, vi } from "vitest";

import type { User } from "@/server/db/schema";
import { checkPasswordResetRateLimit } from "@/server/http/rate-limit";
import { requestPasswordReset } from "@/server/modules/auth/request-password-reset";
import { hashToken } from "@/server/modules/auth/reset-token";
import { sendPasswordResetEmail } from "@/server/modules/email/send-password-reset";
import { getUserByEmail } from "@/server/modules/users/queries/get-by-email";
import { setPasswordResetToken } from "@/server/modules/users/queries/set-password-reset-token";

vi.mock("@/server/http/rate-limit", () => ({
  checkPasswordResetRateLimit: vi.fn(),
}));
vi.mock("@/server/modules/email/send-password-reset", () => ({
  sendPasswordResetEmail: vi.fn(),
}));
vi.mock("@/server/modules/users/queries/get-by-email", () => ({
  getUserByEmail: vi.fn(),
}));
vi.mock("@/server/modules/users/queries/set-password-reset-token", () => ({
  setPasswordResetToken: vi.fn(),
}));

const EMAIL = "user@example.test";
const USER_ID = "user-1";
const RESET_AT = 1_900_000_000_000;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(checkPasswordResetRateLimit).mockResolvedValue({ success: true });
  vi.mocked(getUserByEmail).mockResolvedValue({
    id: USER_ID,
    email: EMAIL,
  } as User);
  vi.mocked(setPasswordResetToken).mockResolvedValue([]);
  vi.mocked(sendPasswordResetEmail).mockResolvedValue({ success: true });
});

describe("requestPasswordReset", () => {
  it("stores the hash of a token and mails the plain token", async () => {
    // Act
    const result = await requestPasswordReset({ email: EMAIL });

    // Assert
    expect(result).toEqual({ status: "sent" });
    const [stored] = vi.mocked(setPasswordResetToken).mock.calls[0];
    const [mailed] = vi.mocked(sendPasswordResetEmail).mock.calls[0];
    expect(stored.userId).toBe(USER_ID);
    expect(mailed.email).toBe(EMAIL);
    expect(stored.hashedToken).toBe(hashToken(mailed.resetToken));
    expect(stored.hashedToken).not.toBe(mailed.resetToken);
    expect(stored.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("stores and sends nothing for an unknown email", async () => {
    // Arrange
    vi.mocked(getUserByEmail).mockResolvedValue(null);

    // Act
    const result = await requestPasswordReset({ email: EMAIL });

    // Assert
    expect(result).toEqual({ status: "unknown_user" });
    expect(setPasswordResetToken).not.toHaveBeenCalled();
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("answers rate_limited with the reset time and looks nothing up", async () => {
    // Arrange
    vi.mocked(checkPasswordResetRateLimit).mockResolvedValue({
      success: false,
      reset: RESET_AT,
    });

    // Act
    const result = await requestPasswordReset({ email: EMAIL });

    // Assert
    expect(result).toEqual({ status: "rate_limited", resetAt: RESET_AT });
    expect(getUserByEmail).not.toHaveBeenCalled();
  });

  it("answers limiter_unavailable when the limit cannot be checked", async () => {
    // Arrange
    vi.mocked(checkPasswordResetRateLimit).mockResolvedValue({
      success: false,
      isUnavailable: true,
    });

    // Act
    const result = await requestPasswordReset({ email: EMAIL });

    // Assert
    expect(result).toEqual({ status: "limiter_unavailable" });
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("answers send_failed when the sender reports a failure", async () => {
    // Arrange
    vi.spyOn(console, "error").mockReturnValue(undefined);
    vi.mocked(sendPasswordResetEmail).mockResolvedValue({
      success: false,
      error: "provider down",
    });

    // Act
    const result = await requestPasswordReset({ email: EMAIL });

    // Assert
    expect(result).toEqual({ status: "send_failed" });
  });
});
