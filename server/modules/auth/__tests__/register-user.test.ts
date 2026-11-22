import { beforeEach, describe, expect, it, vi } from "vitest";

import type { User } from "@/server/db/schema";
import { isSignupEnabled } from "@/server/flags";
import { checkRegisterRateLimit } from "@/server/http/rate-limit";
import {
  type RegisterUserInput,
  registerUser,
} from "@/server/modules/auth/register-user";
import {
  createUser,
  createUserWithDeferredWelcomeGrant,
  DuplicateEmailError,
} from "@/server/modules/users/queries/create-user";
import { getUserByEmail } from "@/server/modules/users/queries/get-by-email";

vi.mock("@/server/flags", () => ({ isSignupEnabled: vi.fn() }));
vi.mock("@/server/http/rate-limit", () => ({
  checkRegisterRateLimit: vi.fn(),
}));
vi.mock("@/server/modules/users/queries/create-user", () => {
  class DuplicateEmailErrorStub extends Error {}

  return {
    createUser: vi.fn(),
    createUserWithDeferredWelcomeGrant: vi.fn(),
    DuplicateEmailError: DuplicateEmailErrorStub,
  };
});
vi.mock("@/server/modules/users/queries/get-by-email", () => ({
  getUserByEmail: vi.fn(),
}));

const EMAIL = "new@example.test";
const PASSWORD = "Str0ng!Pass";
const IP = "203.0.113.7";
const UTM = {
  utmSource: "newsletter",
  utmMedium: null,
  utmCampaign: null,
  utmContent: null,
  utmTerm: null,
};
const GEO = { country: "RU", region: "MOW", city: "Moscow", language: "ru" };

const input: RegisterUserInput = {
  email: EMAIL,
  password: PASSWORD,
  ip: IP,
  utm: UTM,
  geo: GEO,
};
const createdUser = {
  id: "user-1",
  email: EMAIL,
  emailVerified: false,
  isTester: false,
  password: "stored-hash",
} as User;
const createdAccount = {
  id: "user-1",
  email: EMAIL,
  emailVerified: false,
  isTester: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isSignupEnabled).mockResolvedValue(true);
  vi.mocked(checkRegisterRateLimit).mockResolvedValue({ success: true });
  vi.mocked(getUserByEmail).mockResolvedValue(null);
  vi.mocked(createUser).mockResolvedValue(createdUser);
  vi.mocked(createUserWithDeferredWelcomeGrant).mockResolvedValue(createdUser);
});

describe("registerUser", () => {
  it("creates the account with the attribution it was given", async () => {
    // Act
    const result = await registerUser(input);

    // Assert
    // The account, without the password hash of the row.
    expect(result).toEqual({ status: "registered", account: createdAccount });
    expect(createUser).toHaveBeenCalledExactlyOnceWith(
      EMAIL,
      PASSWORD,
      UTM,
      GEO
    );
    expect(checkRegisterRateLimit).toHaveBeenCalledWith(IP);
  });

  it("creates a website account with its welcome grant when no platform is given", async () => {
    // Act
    await registerUser(input);

    // Assert
    expect(createUserWithDeferredWelcomeGrant).not.toHaveBeenCalled();
  });

  it("creates an API account without a welcome grant when a platform is given", async () => {
    // Act
    const result = await registerUser({ ...input, signupPlatform: "ios" });

    // Assert
    expect(result).toEqual({ status: "registered", account: createdAccount });
    expect(createUserWithDeferredWelcomeGrant).toHaveBeenCalledExactlyOnceWith({
      email: EMAIL,
      password: PASSWORD,
      utmData: UTM,
      registrationGeo: GEO,
      signupPlatform: "ios",
    });
    expect(createUser).not.toHaveBeenCalled();
  });

  it("answers user_exists when an API sign-up loses a race for the email", async () => {
    // Arrange
    vi.mocked(createUserWithDeferredWelcomeGrant).mockRejectedValue(
      new DuplicateEmailError(EMAIL)
    );

    // Act
    const result = await registerUser({ ...input, signupPlatform: "android" });

    // Assert
    expect(result).toEqual({ status: "user_exists" });
  });

  it("answers signup_disabled before anything else when the flag is off", async () => {
    // Arrange
    vi.mocked(isSignupEnabled).mockResolvedValue(false);

    // Act
    const result = await registerUser({ ...input, password: "weak" });

    // Assert
    expect(result).toEqual({ status: "signup_disabled" });
    expect(checkRegisterRateLimit).not.toHaveBeenCalled();
    expect(createUser).not.toHaveBeenCalled();
  });

  it("answers weak_password without spending the sign-up limit", async () => {
    // Act
    const result = await registerUser({ ...input, password: "weak" });

    // Assert
    expect(result).toEqual({ status: "weak_password" });
    expect(checkRegisterRateLimit).not.toHaveBeenCalled();
  });

  it.each<[string, { success: boolean; isUnavailable?: boolean }, string]>([
    ["the limit is reached", { success: false }, "rate_limited"],
    [
      "the limit cannot be checked",
      { success: false, isUnavailable: true },
      "limiter_unavailable",
    ],
  ])("creates nothing when %s", async (_case, limit, expectedStatus) => {
    // Arrange
    vi.mocked(checkRegisterRateLimit).mockResolvedValue(limit);

    // Act
    const result = await registerUser(input);

    // Assert
    expect(result).toEqual({ status: expectedStatus });
    expect(getUserByEmail).not.toHaveBeenCalled();
    expect(createUser).not.toHaveBeenCalled();
  });

  it("answers disposable_email for a throwaway mailbox", async () => {
    // Act
    const result = await registerUser({
      ...input,
      email: "someone@mailinator.com",
    });

    // Assert
    expect(result).toEqual({ status: "disposable_email" });
    expect(createUser).not.toHaveBeenCalled();
  });

  it("answers user_exists when the email already has an account", async () => {
    // Arrange
    vi.mocked(getUserByEmail).mockResolvedValue(createdUser);

    // Act
    const result = await registerUser(input);

    // Assert
    expect(result).toEqual({ status: "user_exists" });
    expect(createUser).not.toHaveBeenCalled();
  });

  it("answers user_exists when the insert loses a race for the email", async () => {
    // Arrange
    vi.mocked(createUser).mockRejectedValue(new DuplicateEmailError(EMAIL));

    // Act
    const result = await registerUser(input);

    // Assert
    expect(result).toEqual({ status: "user_exists" });
  });

  it("lets any other failure of the insert through to the caller", async () => {
    // Arrange
    const failure = new Error("connection lost");
    vi.mocked(createUser).mockRejectedValue(failure);

    // Act and assert
    await expect(registerUser(input)).rejects.toBe(failure);
  });
});
