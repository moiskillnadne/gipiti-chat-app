import { beforeEach, describe, expect, it, vi } from "vitest";

import { grantEmailVerificationBonus } from "@/lib/billing/balance";
import type { User } from "@/server/db/schema";
import { checkVerificationAttemptRateLimit } from "@/server/http/rate-limit";
import { hashToken } from "@/server/modules/auth/reset-token";
import { verifyEmailCode } from "@/server/modules/auth/verify-email-code";
import { getUserByEmail } from "@/server/modules/users/queries/get-by-email";
import { markEmailAsVerified } from "@/server/modules/users/queries/mark-email-as-verified";
import { takeVerificationAttempt } from "@/server/modules/users/queries/take-verification-attempt";

vi.mock("@/lib/billing/balance", () => ({
  grantEmailVerificationBonus: vi.fn(),
}));
vi.mock("@/server/http/rate-limit", () => ({
  checkVerificationAttemptRateLimit: vi.fn(),
}));
vi.mock("@/server/modules/users/queries/get-by-email", () => ({
  getUserByEmail: vi.fn(),
}));
vi.mock("@/server/modules/users/queries/mark-email-as-verified", () => ({
  markEmailAsVerified: vi.fn(),
}));
vi.mock("@/server/modules/users/queries/take-verification-attempt", () => ({
  MAX_EMAIL_VERIFICATION_ATTEMPTS: 5,
  takeVerificationAttempt: vi.fn(),
}));

const EMAIL = "user@example.test";
const USER_ID = "user-1";
const CODE = "123456";
const WRONG_CODE = "654321";
const MAX_ATTEMPTS = 5;

type BonusCredit = Awaited<ReturnType<typeof grantEmailVerificationBonus>>;
const bonusCredit = { transactionId: "transaction-1" } as BonusCredit;

const attempt = (attemptsUsed: number) => ({
  userId: USER_ID,
  hashedCode: hashToken(CODE),
  attemptsUsed,
});

const userRow = (overrides: Partial<User>): User =>
  ({ id: USER_ID, email: EMAIL, emailVerified: false, ...overrides }) as User;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(checkVerificationAttemptRateLimit).mockResolvedValue({
    success: true,
  });
  vi.mocked(takeVerificationAttempt).mockResolvedValue(attempt(1));
  vi.mocked(markEmailAsVerified).mockResolvedValue([]);
  vi.mocked(grantEmailVerificationBonus).mockResolvedValue(bonusCredit);
});

describe("verifyEmailCode", () => {
  it("marks the email verified and pays the bonus for the right code", async () => {
    // Act
    const result = await verifyEmailCode({ email: EMAIL, code: CODE });

    // Assert
    expect(result).toEqual({ status: "verified", isBonusGranted: true });
    expect(markEmailAsVerified).toHaveBeenCalledExactlyOnceWith({
      email: EMAIL,
    });
    expect(grantEmailVerificationBonus).toHaveBeenCalledExactlyOnceWith(
      USER_ID
    );
  });

  it("reports no bonus when it was paid before", async () => {
    // Arrange
    vi.mocked(grantEmailVerificationBonus).mockResolvedValue(null);

    // Act
    const result = await verifyEmailCode({ email: EMAIL, code: CODE });

    // Assert
    expect(result).toEqual({ status: "verified", isBonusGranted: false });
  });

  it("still verifies the email when paying the bonus throws", async () => {
    // Arrange
    vi.spyOn(console, "error").mockReturnValue(undefined);
    vi.mocked(grantEmailVerificationBonus).mockRejectedValue(
      new Error("balance locked")
    );

    // Act
    const result = await verifyEmailCode({ email: EMAIL, code: CODE });

    // Assert
    expect(result).toEqual({ status: "verified", isBonusGranted: false });
  });

  it("answers invalid_code with the guesses left for a wrong code", async () => {
    // Arrange
    vi.mocked(takeVerificationAttempt).mockResolvedValue(attempt(2));

    // Act
    const result = await verifyEmailCode({ email: EMAIL, code: WRONG_CODE });

    // Assert
    expect(result).toEqual({
      status: "invalid_code",
      attemptsLeft: MAX_ATTEMPTS - 2,
    });
    expect(markEmailAsVerified).not.toHaveBeenCalled();
  });

  it("answers expired_code for a wrong code on the last attempt", async () => {
    // Arrange
    vi.mocked(takeVerificationAttempt).mockResolvedValue(attempt(MAX_ATTEMPTS));

    // Act
    const result = await verifyEmailCode({ email: EMAIL, code: WRONG_CODE });

    // Assert
    expect(result).toEqual({ status: "expired_code" });
  });

  it("accepts the right code on the last attempt", async () => {
    // Arrange
    vi.mocked(takeVerificationAttempt).mockResolvedValue(attempt(MAX_ATTEMPTS));

    // Act
    const result = await verifyEmailCode({ email: EMAIL, code: CODE });

    // Assert
    expect(result.status).toBe("verified");
  });

  it.each<[string, User | null, object]>([
    [
      "the email is verified already",
      userRow({ emailVerified: true }),
      { status: "already_verified" },
    ],
    [
      "the account still holds a dead code",
      userRow({ emailVerificationCode: "stale-hash" }),
      { status: "expired_code" },
    ],
    [
      "the account never asked for a code",
      userRow({ emailVerificationCode: null }),
      { status: "invalid_code", attemptsLeft: 0 },
    ],
    [
      "no account has the email",
      null,
      { status: "invalid_code", attemptsLeft: 0 },
    ],
  ])(
    "explains why no attempt could be taken when %s",
    async (_case, foundUser, expected) => {
      // Arrange
      vi.mocked(takeVerificationAttempt).mockResolvedValue(null);
      vi.mocked(getUserByEmail).mockResolvedValue(foundUser);

      // Act
      const result = await verifyEmailCode({ email: EMAIL, code: CODE });

      // Assert
      expect(result).toEqual(expected);
    }
  );

  it("answers rate_limited without spending an attempt", async () => {
    // Arrange
    vi.mocked(checkVerificationAttemptRateLimit).mockResolvedValue({
      success: false,
    });

    // Act
    const result = await verifyEmailCode({ email: EMAIL, code: CODE });

    // Assert
    expect(result).toEqual({ status: "rate_limited" });
    expect(takeVerificationAttempt).not.toHaveBeenCalled();
  });
});
