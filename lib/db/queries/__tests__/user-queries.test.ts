import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetMock, setError, setResult } from "./db-mock";

vi.mock("../connection", async () => {
  const mod = await import("./db-mock");
  return { db: mod.mockDb };
});

vi.mock("../utils", () => ({
  generateHashedPassword: vi.fn(() => "hashed_password_123"),
}));

import {
  clearEmailVerificationCode,
  clearPasswordResetToken,
  createUser,
  getUserByResetToken,
  getUserByVerificationCode,
  isEmailVerified,
  markEmailAsVerified,
  setEmailVerificationCode,
  setPasswordResetToken,
  updateUserPassword,
} from "../user-queries";

const DB_ERROR = new Error("connection lost");

const mockUser = {
  id: "u1",
  email: "test@example.com",
  password: "hashed_password_123",
  currentPlan: null,
  preferredLanguage: "ru",
  emailVerified: false,
  isTester: false,
  tokenBalance: 0,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

describe("user-queries", () => {
  beforeEach(() => {
    resetMock();
  });

  // ── createUser ────────────────────────────────────────────────────

  describe("createUser", () => {
    it("creates user with hashed password and default language", async () => {
      setResult([mockUser]);
      const result = await createUser("test@example.com", "password123");
      expect(result).toEqual(mockUser);
    });

    it("uses custom preferred language", async () => {
      const enUser = { ...mockUser, preferredLanguage: "en" };
      setResult([enUser]);
      const result = await createUser("test@example.com", "password123", "en");
      expect(result.preferredLanguage).toBe("en");
    });

    it("defaults to Russian language", async () => {
      setResult([mockUser]);
      const result = await createUser("test@example.com", "password123");
      expect(result.preferredLanguage).toBe("ru");
    });

    it("throws ChatSDKError on database error", async () => {
      setError(DB_ERROR);
      await expect(
        createUser("test@example.com", "password123")
      ).rejects.toMatchObject({ type: "bad_request", surface: "database" });
    });
  });

  // ── setPasswordResetToken ─────────────────────────────────────────

  describe("setPasswordResetToken", () => {
    it("sets reset token on user", async () => {
      setResult([{ ...mockUser, resetPasswordToken: "hashed-token" }]);
      const result = await setPasswordResetToken({
        userId: "u1",
        hashedToken: "hashed-token",
        expiresAt: new Date("2024-01-02"),
      });
      expect(result).toEqual([
        { ...mockUser, resetPasswordToken: "hashed-token" },
      ]);
    });

    it("throws ChatSDKError on database error", async () => {
      setError(DB_ERROR);
      await expect(
        setPasswordResetToken({
          userId: "u1",
          hashedToken: "t",
          expiresAt: new Date(),
        })
      ).rejects.toMatchObject({ type: "bad_request", surface: "database" });
    });
  });

  // ── getUserByResetToken ───────────────────────────────────────────

  describe("getUserByResetToken", () => {
    it("returns user when valid non-expired token", async () => {
      setResult([mockUser]);
      const result = await getUserByResetToken({
        hashedToken: "valid-token",
      });
      expect(result).toEqual(mockUser);
    });

    it("returns null when no matching token", async () => {
      setResult([]);
      const result = await getUserByResetToken({
        hashedToken: "invalid-token",
      });
      expect(result).toBeNull();
    });

    it("throws ChatSDKError on database error", async () => {
      setError(DB_ERROR);
      await expect(
        getUserByResetToken({ hashedToken: "t" })
      ).rejects.toMatchObject({ type: "bad_request", surface: "database" });
    });
  });

  // ── clearPasswordResetToken ───────────────────────────────────────

  describe("clearPasswordResetToken", () => {
    it("clears reset token fields", async () => {
      setResult({ rowCount: 1 });
      const result = await clearPasswordResetToken({ userId: "u1" });
      expect(result).toEqual({ rowCount: 1 });
    });

    it("throws ChatSDKError on database error", async () => {
      setError(DB_ERROR);
      await expect(
        clearPasswordResetToken({ userId: "u1" })
      ).rejects.toMatchObject({ type: "bad_request", surface: "database" });
    });
  });

  // ── updateUserPassword ────────────────────────────────────────────

  describe("updateUserPassword", () => {
    it("updates password and clears reset fields", async () => {
      const updated = { ...mockUser, password: "new-hashed" };
      setResult([updated]);
      const result = await updateUserPassword({
        userId: "u1",
        hashedPassword: "new-hashed",
      });
      expect(result).toEqual([updated]);
    });

    it("throws ChatSDKError on database error", async () => {
      setError(DB_ERROR);
      await expect(
        updateUserPassword({ userId: "u1", hashedPassword: "h" })
      ).rejects.toMatchObject({ type: "bad_request", surface: "database" });
    });
  });

  // ── setEmailVerificationCode ──────────────────────────────────────

  describe("setEmailVerificationCode", () => {
    it("sets verification code on user", async () => {
      setResult([{ ...mockUser, emailVerificationCode: "hashed-code" }]);
      const result = await setEmailVerificationCode({
        email: "test@example.com",
        hashedCode: "hashed-code",
        expiresAt: new Date("2024-01-02"),
      });
      expect(result).toEqual([
        { ...mockUser, emailVerificationCode: "hashed-code" },
      ]);
    });

    it("throws ChatSDKError on database error", async () => {
      setError(DB_ERROR);
      await expect(
        setEmailVerificationCode({
          email: "test@example.com",
          hashedCode: "c",
          expiresAt: new Date(),
        })
      ).rejects.toMatchObject({ type: "bad_request", surface: "database" });
    });
  });

  // ── getUserByVerificationCode ─────────────────────────────────────

  describe("getUserByVerificationCode", () => {
    it("returns user when valid non-expired code", async () => {
      setResult([mockUser]);
      const result = await getUserByVerificationCode({
        hashedCode: "valid-code",
      });
      expect(result).toEqual(mockUser);
    });

    it("returns null when no matching code", async () => {
      setResult([]);
      const result = await getUserByVerificationCode({
        hashedCode: "invalid-code",
      });
      expect(result).toBeNull();
    });

    it("throws ChatSDKError on database error", async () => {
      setError(DB_ERROR);
      await expect(
        getUserByVerificationCode({ hashedCode: "c" })
      ).rejects.toMatchObject({ type: "bad_request", surface: "database" });
    });
  });

  // ── markEmailAsVerified ───────────────────────────────────────────

  describe("markEmailAsVerified", () => {
    it("marks email as verified and clears code", async () => {
      const verified = {
        ...mockUser,
        emailVerified: true,
        emailVerificationCode: null,
      };
      setResult([verified]);
      const result = await markEmailAsVerified({
        email: "test@example.com",
      });
      expect(result).toEqual([verified]);
    });

    it("throws ChatSDKError on database error", async () => {
      setError(DB_ERROR);
      await expect(
        markEmailAsVerified({ email: "test@example.com" })
      ).rejects.toMatchObject({ type: "bad_request", surface: "database" });
    });
  });

  // ── isEmailVerified ───────────────────────────────────────────────

  describe("isEmailVerified", () => {
    it("returns true when email is verified", async () => {
      setResult([{ emailVerified: true }]);
      const result = await isEmailVerified({ email: "test@example.com" });
      expect(result).toBe(true);
    });

    it("returns false when email is not verified", async () => {
      setResult([{ emailVerified: false }]);
      const result = await isEmailVerified({ email: "test@example.com" });
      expect(result).toBe(false);
    });

    it("returns false when user is not found", async () => {
      setResult([]);
      const result = await isEmailVerified({
        email: "nonexistent@example.com",
      });
      expect(result).toBe(false);
    });

    it("throws ChatSDKError on database error", async () => {
      setError(DB_ERROR);
      await expect(
        isEmailVerified({ email: "test@example.com" })
      ).rejects.toMatchObject({ type: "bad_request", surface: "database" });
    });
  });

  // ── clearEmailVerificationCode ────────────────────────────────────

  describe("clearEmailVerificationCode", () => {
    it("clears verification code fields", async () => {
      setResult({ rowCount: 1 });
      const result = await clearEmailVerificationCode({
        email: "test@example.com",
      });
      expect(result).toEqual({ rowCount: 1 });
    });

    it("throws ChatSDKError on database error", async () => {
      setError(DB_ERROR);
      await expect(
        clearEmailVerificationCode({ email: "test@example.com" })
      ).rejects.toMatchObject({ type: "bad_request", surface: "database" });
    });
  });
});
