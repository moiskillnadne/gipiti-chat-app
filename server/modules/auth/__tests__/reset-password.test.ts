import { beforeEach, describe, expect, it, vi } from "vitest";

import type { User } from "@/server/db/schema";
import { generateHashedPassword } from "@/server/db/utils";
import { resetPassword } from "@/server/modules/auth/reset-password";
import { hashToken } from "@/server/modules/auth/reset-token";
import { sendPasswordChangedEmail } from "@/server/modules/email/send-password-changed";
import { getUserByResetToken } from "@/server/modules/users/queries/get-user-by-reset-token";
import { updateUserPassword } from "@/server/modules/users/queries/update-user-password";

vi.mock("@/server/db/utils", () => ({ generateHashedPassword: vi.fn() }));
vi.mock("@/server/modules/email/send-password-changed", () => ({
  sendPasswordChangedEmail: vi.fn(),
}));
vi.mock("@/server/modules/users/queries/get-user-by-reset-token", () => ({
  getUserByResetToken: vi.fn(),
}));
vi.mock("@/server/modules/users/queries/update-user-password", () => ({
  updateUserPassword: vi.fn(),
}));

const EMAIL = "user@example.test";
const USER_ID = "user-1";
const TOKEN = "plain-reset-token";
const NEW_PASSWORD = "Str0ng!Pass";
const HASHED_PASSWORD = "hashed-new-password";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getUserByResetToken).mockResolvedValue({
    id: USER_ID,
    email: EMAIL,
  } as User);
  vi.mocked(generateHashedPassword).mockReturnValue(HASHED_PASSWORD);
  vi.mocked(updateUserPassword).mockResolvedValue([]);
  vi.mocked(sendPasswordChangedEmail).mockResolvedValue({ success: true });
});

describe("resetPassword", () => {
  it("stores the hashed password for the token's account and mails a notice", async () => {
    // Act
    const result = await resetPassword({
      token: TOKEN,
      password: NEW_PASSWORD,
    });

    // Assert
    expect(result).toEqual({ status: "password_reset" });
    expect(getUserByResetToken).toHaveBeenCalledWith({
      hashedToken: hashToken(TOKEN),
    });
    expect(updateUserPassword).toHaveBeenCalledExactlyOnceWith({
      userId: USER_ID,
      hashedPassword: HASHED_PASSWORD,
    });
    expect(sendPasswordChangedEmail).toHaveBeenCalledWith({ email: EMAIL });
  });

  it("answers invalid_token and changes nothing when no account holds the token", async () => {
    // Arrange
    vi.mocked(getUserByResetToken).mockResolvedValue(null);

    // Act
    const result = await resetPassword({
      token: TOKEN,
      password: NEW_PASSWORD,
    });

    // Assert
    expect(result).toEqual({ status: "invalid_token" });
    expect(updateUserPassword).not.toHaveBeenCalled();
    expect(sendPasswordChangedEmail).not.toHaveBeenCalled();
  });

  it("answers weak_password without looking the token up", async () => {
    // Act
    const result = await resetPassword({ token: TOKEN, password: "weak" });

    // Assert
    expect(result).toEqual({ status: "weak_password" });
    expect(getUserByResetToken).not.toHaveBeenCalled();
  });

  it("still succeeds when the notice cannot be sent", async () => {
    // Arrange
    vi.mocked(sendPasswordChangedEmail).mockResolvedValue({
      success: false,
      error: "provider down",
    });

    // Act
    const result = await resetPassword({
      token: TOKEN,
      password: NEW_PASSWORD,
    });

    // Assert
    expect(result).toEqual({ status: "password_reset" });
  });
});
