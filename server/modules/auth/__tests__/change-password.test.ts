import { beforeEach, describe, expect, it, vi } from "vitest";

import type { User } from "@/server/db/schema";
import { generateHashedPassword } from "@/server/db/utils";
import { authenticateCredentials } from "@/server/modules/auth/authenticate-credentials";
import { changePassword } from "@/server/modules/auth/change-password";
import { rememberTokenVersion } from "@/server/modules/auth/token-version";
import { sendPasswordChangedEmail } from "@/server/modules/email/send-password-changed";
import { getUserById } from "@/server/modules/users/queries/get-by-id";
import { updateUserPassword } from "@/server/modules/users/queries/update-user-password";

vi.mock("@/server/db/utils", () => ({ generateHashedPassword: vi.fn() }));
vi.mock("@/server/modules/auth/authenticate-credentials", () => ({
  authenticateCredentials: vi.fn(),
}));
vi.mock("@/server/modules/auth/token-version", () => ({
  rememberTokenVersion: vi.fn(),
}));
vi.mock("@/server/modules/email/send-password-changed", () => ({
  sendPasswordChangedEmail: vi.fn(),
}));
vi.mock("@/server/modules/users/queries/get-by-id", () => ({
  getUserById: vi.fn(),
}));
vi.mock("@/server/modules/users/queries/update-user-password", () => ({
  updateUserPassword: vi.fn(),
}));

const USER_ID = "user-1";
const EMAIL = "user@example.test";
const CURRENT_PASSWORD = "Curr3nt!Pass";
const NEW_PASSWORD = "N3w!Password";
const HASHED_NEW_PASSWORD = "hashed-new-password";
const IP = "203.0.113.7";
const OLD_TOKEN_VERSION = 2;
const NEW_TOKEN_VERSION = 3;

const userRow = (tokenVersion: number): User =>
  ({
    id: USER_ID,
    email: EMAIL,
    emailVerified: true,
    isTester: false,
    tokenVersion,
    password: "stored-hash",
  }) as User;

const input = {
  userId: USER_ID,
  currentPassword: CURRENT_PASSWORD,
  newPassword: NEW_PASSWORD,
  ip: IP,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getUserById).mockResolvedValue(userRow(OLD_TOKEN_VERSION));
  vi.mocked(authenticateCredentials).mockResolvedValue({
    status: "authenticated",
    account: {
      id: USER_ID,
      email: EMAIL,
      emailVerified: true,
      isTester: false,
      tokenVersion: OLD_TOKEN_VERSION,
    },
  });
  vi.mocked(generateHashedPassword).mockReturnValue(HASHED_NEW_PASSWORD);
  vi.mocked(updateUserPassword).mockResolvedValue([userRow(NEW_TOKEN_VERSION)]);
  vi.mocked(sendPasswordChangedEmail).mockResolvedValue({ success: true });
});

describe("changePassword", () => {
  it("stores the new password on proof of the current one and answers the account under its new token version", async () => {
    // Act
    const result = await changePassword(input);

    // Assert
    expect(authenticateCredentials).toHaveBeenCalledExactlyOnceWith({
      email: EMAIL,
      password: CURRENT_PASSWORD,
      ip: IP,
    });
    expect(updateUserPassword).toHaveBeenCalledExactlyOnceWith({
      userId: USER_ID,
      hashedPassword: HASHED_NEW_PASSWORD,
    });
    expect(result).toEqual({
      status: "password_changed",
      account: {
        id: USER_ID,
        email: EMAIL,
        emailVerified: true,
        isTester: false,
        // Not the version the password was checked under: the change raised
        // it, and the caller's new session must be issued under the new one.
        tokenVersion: NEW_TOKEN_VERSION,
      },
    });
  });

  it("tells the cache the new token version and mails a notice", async () => {
    // Act
    await changePassword(input);

    // Assert
    expect(rememberTokenVersion).toHaveBeenCalledExactlyOnceWith(
      USER_ID,
      NEW_TOKEN_VERSION
    );
    expect(sendPasswordChangedEmail).toHaveBeenCalledWith({ email: EMAIL });
  });

  it("answers weak_password without checking the current one, so no login attempt is spent", async () => {
    // Act
    const result = await changePassword({ ...input, newPassword: "weak" });

    // Assert
    expect(result).toEqual({ status: "weak_password" });
    expect(authenticateCredentials).not.toHaveBeenCalled();
    expect(updateUserPassword).not.toHaveBeenCalled();
  });

  it.each([
    "invalid_credentials",
    "rate_limited",
    "limiter_unavailable",
  ] as const)(
    "changes nothing when the check of the current password answers %s",
    async (status) => {
      // Arrange
      vi.mocked(authenticateCredentials).mockResolvedValue({ status });

      // Act
      const result = await changePassword(input);

      // Assert
      expect(result).toEqual({ status });
      expect(updateUserPassword).not.toHaveBeenCalled();
      expect(sendPasswordChangedEmail).not.toHaveBeenCalled();
    }
  );

  it.each<[string, () => void]>([
    [
      "before the check",
      () => {
        vi.mocked(getUserById).mockResolvedValue(null);
      },
    ],
    [
      "during the update",
      () => {
        vi.mocked(updateUserPassword).mockResolvedValue([]);
      },
    ],
  ])(
    "answers invalid_credentials when the account vanished %s",
    async (_case, arrange) => {
      // Arrange
      arrange();

      // Act
      const result = await changePassword(input);

      // Assert
      expect(result).toEqual({ status: "invalid_credentials" });
      expect(rememberTokenVersion).not.toHaveBeenCalled();
    }
  );
});
