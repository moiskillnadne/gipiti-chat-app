import { beforeEach, describe, expect, it, vi } from "vitest";

import { getUserByEmail } from "@/lib/db/query/user/get-by-email";
import { sendPasswordResetEmail } from "@/lib/email/send-password-reset";
import { sendVerificationEmail } from "@/lib/email/send-verification-email";
import {
  checkPasswordResetRateLimit,
  checkVerificationResendRateLimit,
  getRateLimitResetMinutes,
  getRateLimitResetSeconds,
} from "@/server/http/rate-limit";

// In production the auth limiters refuse a request when they cannot be
// checked (`isUnavailable`). These tests cover what the actions do with that
// answer; the limiter's own behaviour is in `lib/__tests__/rate-limit.test.ts`.
vi.mock("server-only", () => ({}));
vi.mock("@/server/db/connection", () => ({ db: {} }));
vi.mock("@/app/(auth)/auth", () => ({ signIn: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/server/flags", () => ({ isSignupEnabled: vi.fn() }));
vi.mock("@/server/http/rate-limit", () => ({
  checkPasswordResetRateLimit: vi.fn(),
  checkVerificationResendRateLimit: vi.fn(),
  getRateLimitResetMinutes: vi.fn(),
  getRateLimitResetSeconds: vi.fn(),
}));
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

import {
  requestPasswordReset,
  resendVerificationCode,
} from "@/app/(auth)/actions";

const USER_EMAIL = "user@example.test";
const LIMITER_UNAVAILABLE = { success: false, isUnavailable: true };

const emailForm = (): FormData => {
  const data = new FormData();
  data.set("email", USER_EMAIL);
  return data;
};

describe("auth actions when the rate limiter cannot be checked", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resendVerificationCode fails without sending a code or a cooldown", async () => {
    // Arrange
    vi.mocked(checkVerificationResendRateLimit).mockResolvedValue(
      LIMITER_UNAVAILABLE
    );

    // Act
    const state = await resendVerificationCode({ status: "idle" }, emailForm());

    // Assert
    expect(state).toEqual({ status: "failed" });
    expect(getRateLimitResetSeconds).not.toHaveBeenCalled();
    expect(getUserByEmail).not.toHaveBeenCalled();
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("requestPasswordReset fails without sending a link or a reset time", async () => {
    // Arrange
    vi.mocked(checkPasswordResetRateLimit).mockResolvedValue(
      LIMITER_UNAVAILABLE
    );

    // Act
    const state = await requestPasswordReset({ status: "idle" }, emailForm());

    // Assert
    expect(state).toEqual({ status: "failed" });
    expect(getRateLimitResetMinutes).not.toHaveBeenCalled();
    expect(getUserByEmail).not.toHaveBeenCalled();
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });
});
