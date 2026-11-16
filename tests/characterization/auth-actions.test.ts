import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { grantEmailVerificationBonus } from "@/lib/billing/balance";
import {
  createUser,
  DuplicateEmailError,
} from "@/lib/db/query/user/create-user";
import { getUserByEmail } from "@/lib/db/query/user/get-by-email";
import { getUserByResetToken } from "@/lib/db/query/user/get-user-by-reset-token";
import { markEmailAsVerified } from "@/lib/db/query/user/mark-email-as-verified";
import { setPasswordResetToken } from "@/lib/db/query/user/set-password-reset-token";
import { takeVerificationAttempt } from "@/lib/db/query/user/take-verification-attempt";
import { updateUserPassword } from "@/lib/db/query/user/update-user-password";
import type { User } from "@/lib/db/schema";
import { generateHashedPassword } from "@/lib/db/utils";
import { sendPasswordChangedEmail } from "@/lib/email/send-password-changed";
import { sendPasswordResetEmail } from "@/lib/email/send-password-reset";
import { sendVerificationEmail } from "@/lib/email/send-verification-email";
import {
  getRegistrationGeoFromHeaders,
  sanitizeLanguage,
} from "@/lib/geo/registration-geo";
import {
  checkPasswordResetRateLimit,
  checkVerificationAttemptRateLimit,
  checkVerificationResendRateLimit,
  getRateLimitResetMinutes,
  getRateLimitResetSeconds,
} from "@/lib/rate-limit";

import {
  login,
  register,
  requestPasswordReset,
  resendVerificationCode,
  resetPassword,
  verifyEmail,
} from "./targets/auth-actions";

type SignInOptions = { email: string; password: string; redirect: boolean };
type SignInResult = { error?: string; ok?: boolean } | undefined;
type CookieEntry = { name: string; value: string } | undefined;

const { signInMock, isSignupEnabledMock, cookieGetMock, cookieDeleteMock } =
  vi.hoisted(() => ({
    signInMock:
      vi.fn<
        (provider: string, options: SignInOptions) => Promise<SignInResult>
      >(),
    isSignupEnabledMock: vi.fn<() => Promise<boolean>>(),
    cookieGetMock: vi.fn<(name: string) => CookieEntry>(),
    cookieDeleteMock: vi.fn<(name: string) => void>(),
  }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/connection", () => ({ db: {} }));
vi.mock("@/app/(auth)/auth", () => ({ signIn: signInMock }));
vi.mock("next/headers", () => ({
  cookies: () =>
    Promise.resolve({ get: cookieGetMock, delete: cookieDeleteMock }),
}));
vi.mock("@/lib/flags", () => ({ isSignupEnabled: isSignupEnabledMock }));
vi.mock("@/lib/rate-limit", () => ({
  checkPasswordResetRateLimit: vi.fn(),
  checkVerificationAttemptRateLimit: vi.fn(),
  checkVerificationResendRateLimit: vi.fn(),
  getRateLimitResetMinutes: vi.fn(),
  getRateLimitResetSeconds: vi.fn(),
}));
vi.mock("@/lib/geo/registration-geo", () => ({
  getRegistrationGeoFromHeaders: vi.fn(),
  sanitizeLanguage: vi.fn(),
}));
vi.mock("@/lib/billing/balance", () => ({
  grantEmailVerificationBonus: vi.fn(),
}));
vi.mock("@/lib/db/utils", () => ({ generateHashedPassword: vi.fn() }));
vi.mock("@/lib/db/query/user/get-by-email", () => ({
  getUserByEmail: vi.fn(),
}));
vi.mock("@/lib/db/query/user/get-user-by-reset-token", () => ({
  getUserByResetToken: vi.fn(),
}));
vi.mock("@/lib/db/query/user/take-verification-attempt", () => ({
  MAX_EMAIL_VERIFICATION_ATTEMPTS: 5,
  takeVerificationAttempt: vi.fn(),
}));
vi.mock("@/lib/db/query/user/mark-email-as-verified", () => ({
  markEmailAsVerified: vi.fn(),
}));
vi.mock("@/lib/db/query/user/update-user-password", () => ({
  updateUserPassword: vi.fn(),
}));
vi.mock("@/lib/db/query/user/set-password-reset-token", () => ({
  setPasswordResetToken: vi.fn(),
}));
// The action tells a lost signup race apart with `instanceof`, so the error
// class stays the real one; only the insert itself is replaced.
vi.mock("@/lib/db/query/user/create-user", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/db/query/user/create-user")
  >("@/lib/db/query/user/create-user");
  return {
    DuplicateEmailError: actual.DuplicateEmailError,
    createUser: vi.fn(),
  };
});
vi.mock("@/lib/email/send-verification-email", () => ({
  sendVerificationEmail: vi.fn(),
}));
vi.mock("@/lib/email/send-password-reset", () => ({
  sendPasswordResetEmail: vi.fn(),
}));
vi.mock("@/lib/email/send-password-changed", () => ({
  sendPasswordChangedEmail: vi.fn(),
}));

const USER_ID = "user-1";
const USER_EMAIL = "user@example.test";
const STRONG_PASSWORD = "Str0ng!Pass";
const VERIFICATION_CODE = "123456";
const RESET_TOKEN = "plain-reset-token";
const HASHED_PASSWORD = "hashed-new-password";
const UTM_COOKIE_NAME = "utm_params";
const RATE_LIMIT_RESET_AT = 1_900_000_000_000;
const COOLDOWN_SECONDS = 42;
const RESET_MINUTES = 7;
const GEO_HEADERS = { country: "RU", region: "MOW", city: "Moscow" };
const LANGUAGE = "ru-RU";
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

const sha256Hex = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const formData = (fields: Record<string, string>): FormData => {
  const data = new FormData();
  for (const [fieldName, fieldValue] of Object.entries(fields)) {
    data.set(fieldName, fieldValue);
  }
  return data;
};

const userRow = (overrides: Partial<User> = {}): User =>
  ({
    id: USER_ID,
    email: USER_EMAIL,
    emailVerified: false,
    ...overrides,
  }) as User;

/** Every dependency answers the happy path; a test overrides what it pins. */
const arrangeHappyPathDefaults = (): void => {
  signInMock.mockResolvedValue(undefined);
  isSignupEnabledMock.mockResolvedValue(true);
  cookieGetMock.mockReturnValue(undefined);
  vi.mocked(getUserByEmail).mockResolvedValue(null);
  vi.mocked(takeVerificationAttempt).mockResolvedValue(null);
  vi.mocked(getUserByResetToken).mockResolvedValue(null);
  vi.mocked(createUser).mockResolvedValue(userRow());
  vi.mocked(markEmailAsVerified).mockResolvedValue([]);
  vi.mocked(updateUserPassword).mockResolvedValue([]);
  vi.mocked(setPasswordResetToken).mockResolvedValue([]);
  vi.mocked(grantEmailVerificationBonus).mockResolvedValue(null);
  vi.mocked(generateHashedPassword).mockReturnValue(HASHED_PASSWORD);
  vi.mocked(getRegistrationGeoFromHeaders).mockResolvedValue(GEO_HEADERS);
  vi.mocked(sanitizeLanguage).mockReturnValue(LANGUAGE);
  vi.mocked(checkPasswordResetRateLimit).mockResolvedValue({ success: true });
  vi.mocked(checkVerificationResendRateLimit).mockResolvedValue({
    success: true,
  });
  vi.mocked(checkVerificationAttemptRateLimit).mockResolvedValue({
    success: true,
  });
  vi.mocked(getRateLimitResetSeconds).mockReturnValue(COOLDOWN_SECONDS);
  vi.mocked(getRateLimitResetMinutes).mockReturnValue(RESET_MINUTES);
  vi.mocked(sendVerificationEmail).mockResolvedValue({ success: true });
  vi.mocked(sendPasswordResetEmail).mockResolvedValue({ success: true });
  vi.mocked(sendPasswordChangedEmail).mockResolvedValue({ success: true });
};

beforeEach(() => {
  vi.clearAllMocks();
  arrangeHappyPathDefaults();
});

describe("login", () => {
  const credentials = { email: USER_EMAIL, password: STRONG_PASSWORD };

  it("returns success and signs in with the credentials without a redirect", async () => {
    // Act
    const state = await login({ status: "idle" }, formData(credentials));

    // Assert
    expect(state).toEqual({ status: "success" });
    expect(signInMock).toHaveBeenCalledTimes(1);
    expect(signInMock).toHaveBeenCalledWith("credentials", {
      email: USER_EMAIL,
      password: STRONG_PASSWORD,
      redirect: false,
    });
  });

  it("accepts a one-character password, since login only requires a non-empty one", async () => {
    // Act
    const state = await login(
      { status: "idle" },
      formData({ email: USER_EMAIL, password: "a" })
    );

    // Assert
    expect(state).toEqual({ status: "success" });
    expect(signInMock).toHaveBeenCalledTimes(1);
  });

  it.each<[string, SignInResult]>([
    ["an error", { error: "CredentialsSignin" }],
    ["ok: false", { ok: false }],
  ])("returns failed when signIn resolves with %s", async (_label, result) => {
    // Arrange
    signInMock.mockResolvedValue(result);

    // Act
    const state = await login({ status: "idle" }, formData(credentials));

    // Assert
    expect(state).toEqual({ status: "failed" });
  });

  it("returns failed when signIn throws", async () => {
    // Arrange
    signInMock.mockRejectedValue(new Error("CredentialsSignin"));

    // Act
    const state = await login({ status: "idle" }, formData(credentials));

    // Assert
    expect(state).toEqual({ status: "failed" });
  });

  it.each<[string, Record<string, string>]>([
    ["a malformed email", { email: "not-an-email", password: STRONG_PASSWORD }],
    ["an empty password", { email: USER_EMAIL, password: "" }],
    ["a missing password", { email: USER_EMAIL }],
    ["a missing email", { password: STRONG_PASSWORD }],
  ])(
    "returns invalid_data for %s and does not sign in",
    async (_label, fields) => {
      // Act
      const state = await login({ status: "idle" }, formData(fields));

      // Assert
      expect(state).toEqual({ status: "invalid_data" });
      expect(signInMock).not.toHaveBeenCalled();
    }
  );
});

describe("register", () => {
  const registration = {
    email: USER_EMAIL,
    password: STRONG_PASSWORD,
    language: LANGUAGE,
  };

  it("returns failed and creates no user when signup is disabled", async () => {
    // Arrange
    isSignupEnabledMock.mockResolvedValue(false);

    // Act
    const state = await register({ status: "idle" }, formData(registration));

    // Assert
    expect(state).toEqual({ status: "failed" });
    expect(getUserByEmail).not.toHaveBeenCalled();
    expect(createUser).not.toHaveBeenCalled();
    expect(signInMock).not.toHaveBeenCalled();
  });

  it("returns failed, not invalid_data, for bad input while signup is disabled", async () => {
    // Arrange
    isSignupEnabledMock.mockResolvedValue(false);

    // Act
    const state = await register(
      { status: "idle" },
      formData({ email: "not-an-email", password: "weak" })
    );

    // Assert
    expect(state).toEqual({ status: "failed" });
  });

  it.each<[string, Record<string, string>]>([
    ["a malformed email", { email: "not-an-email", password: STRONG_PASSWORD }],
    ["a password under 8 characters", { email: USER_EMAIL, password: "S0!a" }],
    [
      "a password without an uppercase letter",
      { email: USER_EMAIL, password: "str0ng!pass" },
    ],
    [
      "a password without a lowercase letter",
      { email: USER_EMAIL, password: "STR0NG!PASS" },
    ],
    [
      "a password without a digit",
      { email: USER_EMAIL, password: "Strong!Pass" },
    ],
    [
      "a password without a special character",
      { email: USER_EMAIL, password: "Str0ngPass1" },
    ],
  ])(
    "returns invalid_data for %s and creates no user",
    async (_label, fields) => {
      // Act
      const state = await register({ status: "idle" }, formData(fields));

      // Assert
      expect(state).toEqual({ status: "invalid_data" });
      expect(getUserByEmail).not.toHaveBeenCalled();
      expect(createUser).not.toHaveBeenCalled();
    }
  );

  it("returns user_exists when the email already has an account", async () => {
    // Arrange
    vi.mocked(getUserByEmail).mockResolvedValue(userRow());

    // Act
    const state = await register({ status: "idle" }, formData(registration));

    // Assert
    expect(state).toEqual({ status: "user_exists" });
    expect(getUserByEmail).toHaveBeenCalledWith(USER_EMAIL);
    expect(createUser).not.toHaveBeenCalled();
    expect(signInMock).not.toHaveBeenCalled();
  });

  it("returns user_exists when the insert loses a signup race (DuplicateEmailError)", async () => {
    // Arrange
    vi.mocked(createUser).mockRejectedValue(
      new DuplicateEmailError(USER_EMAIL)
    );

    // Act
    const state = await register({ status: "idle" }, formData(registration));

    // Assert
    expect(state).toEqual({ status: "user_exists" });
    expect(signInMock).not.toHaveBeenCalled();
  });

  it("creates the user with UTM, geo and language, clears the cookie, signs in", async () => {
    // Arrange
    const utmCookieValue = encodeURIComponent(
      JSON.stringify({ utm_source: "yandex", utm_medium: "cpc" })
    );
    cookieGetMock.mockReturnValue({
      name: UTM_COOKIE_NAME,
      value: utmCookieValue,
    });

    // Act
    const state = await register({ status: "idle" }, formData(registration));

    // Assert
    expect(state).toEqual({ status: "success" });
    expect(cookieGetMock).toHaveBeenCalledWith(UTM_COOKIE_NAME);
    expect(sanitizeLanguage).toHaveBeenCalledWith(LANGUAGE);
    expect(createUser).toHaveBeenCalledTimes(1);
    expect(createUser).toHaveBeenCalledWith(
      USER_EMAIL,
      STRONG_PASSWORD,
      {
        utmSource: "yandex",
        utmMedium: "cpc",
        utmCampaign: null,
        utmContent: null,
        utmTerm: null,
      },
      { ...GEO_HEADERS, language: LANGUAGE }
    );
    expect(cookieDeleteMock).toHaveBeenCalledTimes(1);
    expect(cookieDeleteMock).toHaveBeenCalledWith(UTM_COOKIE_NAME);
    expect(signInMock).toHaveBeenCalledTimes(1);
    expect(signInMock).toHaveBeenCalledWith("credentials", {
      email: USER_EMAIL,
      password: STRONG_PASSWORD,
      redirect: false,
    });
  });

  it("creates the user without UTM when there is no UTM cookie", async () => {
    // Act
    const state = await register({ status: "idle" }, formData(registration));

    // Assert
    expect(state).toEqual({ status: "success" });
    expect(createUser).toHaveBeenCalledWith(
      USER_EMAIL,
      STRONG_PASSWORD,
      undefined,
      { ...GEO_HEADERS, language: LANGUAGE }
    );
    expect(cookieDeleteMock).not.toHaveBeenCalled();
  });

  it("creates the user without UTM but clears a UTM cookie that is not JSON", async () => {
    // Arrange
    cookieGetMock.mockReturnValue({ name: UTM_COOKIE_NAME, value: "not-json" });

    // Act
    const state = await register({ status: "idle" }, formData(registration));

    // Assert
    expect(state).toEqual({ status: "success" });
    expect(createUser).toHaveBeenCalledWith(
      USER_EMAIL,
      STRONG_PASSWORD,
      undefined,
      { ...GEO_HEADERS, language: LANGUAGE }
    );
    expect(cookieDeleteMock).toHaveBeenCalledWith(UTM_COOKIE_NAME);
  });

  it("returns success even when the automatic sign-in resolves with an error", async () => {
    // Arrange
    signInMock.mockResolvedValue({ error: "CredentialsSignin" });

    // Act
    const state = await register({ status: "idle" }, formData(registration));

    // Assert
    expect(state).toEqual({ status: "success" });
    expect(createUser).toHaveBeenCalledTimes(1);
  });

  it("returns failed when creating the user throws an unexpected error", async () => {
    // Arrange
    vi.mocked(createUser).mockRejectedValue(new Error("insert failed"));

    // Act
    const state = await register({ status: "idle" }, formData(registration));

    // Assert
    expect(state).toEqual({ status: "failed" });
    expect(signInMock).not.toHaveBeenCalled();
  });
});

describe("verifyEmail", () => {
  const verification = { email: USER_EMAIL, code: VERIFICATION_CODE };
  const WRONG_CODE = "654321";
  const MAX_ATTEMPTS = 5;

  /** An attempt taken on a live code whose stored hash is VERIFICATION_CODE. */
  const liveAttempt = (attemptsUsed = 1) => ({
    userId: USER_ID,
    hashedCode: sha256Hex(VERIFICATION_CODE),
    attemptsUsed,
  });

  it("returns success, marks the email verified and grants the bonus", async () => {
    // Arrange
    vi.mocked(takeVerificationAttempt).mockResolvedValue(liveAttempt());

    // Act
    const state = await verifyEmail({ status: "idle" }, formData(verification));

    // Assert
    expect(state).toEqual({ status: "success" });
    expect(checkVerificationAttemptRateLimit).toHaveBeenCalledWith(USER_EMAIL);
    expect(takeVerificationAttempt).toHaveBeenCalledTimes(1);
    expect(takeVerificationAttempt).toHaveBeenCalledWith({ email: USER_EMAIL });
    expect(markEmailAsVerified).toHaveBeenCalledTimes(1);
    expect(markEmailAsVerified).toHaveBeenCalledWith({ email: USER_EMAIL });
    expect(grantEmailVerificationBonus).toHaveBeenCalledTimes(1);
    expect(grantEmailVerificationBonus).toHaveBeenCalledWith(USER_ID);
  });

  it("accepts the right code on the last attempt", async () => {
    // Arrange
    vi.mocked(takeVerificationAttempt).mockResolvedValue(
      liveAttempt(MAX_ATTEMPTS)
    );

    // Act
    const state = await verifyEmail({ status: "idle" }, formData(verification));

    // Assert
    expect(state).toEqual({ status: "success" });
    expect(markEmailAsVerified).toHaveBeenCalledTimes(1);
  });

  it("still returns success when granting the bonus throws", async () => {
    // Arrange
    vi.mocked(takeVerificationAttempt).mockResolvedValue(liveAttempt());
    vi.mocked(grantEmailVerificationBonus).mockRejectedValue(
      new Error("bonus failed")
    );

    // Act
    const state = await verifyEmail({ status: "idle" }, formData(verification));

    // Assert
    expect(state).toEqual({ status: "success" });
    expect(markEmailAsVerified).toHaveBeenCalledTimes(1);
  });

  it("looks the code up by the email as typed and leaves the case to the query", async () => {
    // Arrange
    const typedEmail = "User@Example.test";
    vi.mocked(takeVerificationAttempt).mockResolvedValue(liveAttempt());

    // Act
    const state = await verifyEmail(
      { status: "idle" },
      formData({ email: typedEmail, code: VERIFICATION_CODE })
    );

    // Assert
    expect(state).toEqual({ status: "success" });
    expect(takeVerificationAttempt).toHaveBeenCalledWith({ email: typedEmail });
    expect(markEmailAsVerified).toHaveBeenCalledWith({ email: typedEmail });
  });

  it("returns invalid_code for a wrong code while attempts remain", async () => {
    // Arrange
    vi.mocked(takeVerificationAttempt).mockResolvedValue(
      liveAttempt(MAX_ATTEMPTS - 1)
    );

    // Act
    const state = await verifyEmail(
      { status: "idle" },
      formData({ email: USER_EMAIL, code: WRONG_CODE })
    );

    // Assert
    expect(state).toEqual({ status: "invalid_code" });
    expect(markEmailAsVerified).not.toHaveBeenCalled();
    expect(grantEmailVerificationBonus).not.toHaveBeenCalled();
  });

  it("returns expired_code for a wrong code on the last attempt", async () => {
    // Arrange
    vi.mocked(takeVerificationAttempt).mockResolvedValue(
      liveAttempt(MAX_ATTEMPTS)
    );

    // Act
    const state = await verifyEmail(
      { status: "idle" },
      formData({ email: USER_EMAIL, code: WRONG_CODE })
    );

    // Assert
    expect(state).toEqual({ status: "expired_code" });
    expect(markEmailAsVerified).not.toHaveBeenCalled();
    expect(grantEmailVerificationBonus).not.toHaveBeenCalled();
  });

  it.each<[string, User | null]>([
    ["the email has no account", null],
    [
      "the email's account has no code",
      userRow({ emailVerified: false, emailVerificationCode: null }),
    ],
  ])(
    "returns invalid_code when no attempt can be taken and %s",
    async (_label, userByEmail) => {
      // Arrange
      vi.mocked(getUserByEmail).mockResolvedValue(userByEmail);

      // Act
      const state = await verifyEmail(
        { status: "idle" },
        formData(verification)
      );

      // Assert
      expect(state).toEqual({ status: "invalid_code" });
      expect(getUserByEmail).toHaveBeenCalledWith(USER_EMAIL);
      expect(markEmailAsVerified).not.toHaveBeenCalled();
      expect(grantEmailVerificationBonus).not.toHaveBeenCalled();
    }
  );

  it("returns expired_code when no attempt can be taken and the account still holds a code", async () => {
    // Arrange: the code expired or its attempts are used up.
    vi.mocked(getUserByEmail).mockResolvedValue(
      userRow({
        emailVerified: false,
        emailVerificationCode: sha256Hex(VERIFICATION_CODE),
      })
    );

    // Act
    const state = await verifyEmail({ status: "idle" }, formData(verification));

    // Assert
    expect(state).toEqual({ status: "expired_code" });
    expect(markEmailAsVerified).not.toHaveBeenCalled();
    expect(grantEmailVerificationBonus).not.toHaveBeenCalled();
  });

  it("returns already_verified when no attempt can be taken and the email is verified", async () => {
    // Arrange
    vi.mocked(getUserByEmail).mockResolvedValue(
      userRow({ emailVerified: true })
    );

    // Act
    const state = await verifyEmail({ status: "idle" }, formData(verification));

    // Assert
    expect(state).toEqual({ status: "already_verified" });
    expect(markEmailAsVerified).not.toHaveBeenCalled();
    expect(grantEmailVerificationBonus).not.toHaveBeenCalled();
  });

  it.each<[string, { success: boolean; isUnavailable?: boolean }]>([
    ["the limit is reached", { success: false }],
    ["the limiter cannot be checked", { success: false, isUnavailable: true }],
  ])(
    "returns failed without taking an attempt when %s",
    async (_label, limit) => {
      // Arrange
      vi.mocked(checkVerificationAttemptRateLimit).mockResolvedValue(limit);

      // Act
      const state = await verifyEmail(
        { status: "idle" },
        formData(verification)
      );

      // Assert
      expect(state).toEqual({ status: "failed" });
      expect(takeVerificationAttempt).not.toHaveBeenCalled();
      expect(markEmailAsVerified).not.toHaveBeenCalled();
    }
  );

  it.each<[string, Record<string, string>]>([
    ["a malformed email", { email: "not-an-email", code: VERIFICATION_CODE }],
    ["a code shorter than 6 characters", { email: USER_EMAIL, code: "12345" }],
    ["a code longer than 6 characters", { email: USER_EMAIL, code: "1234567" }],
    ["a missing code", { email: USER_EMAIL }],
  ])("returns invalid_data for %s", async (_label, fields) => {
    // Act
    const state = await verifyEmail({ status: "idle" }, formData(fields));

    // Assert
    expect(state).toEqual({ status: "invalid_data" });
    expect(checkVerificationAttemptRateLimit).not.toHaveBeenCalled();
    expect(takeVerificationAttempt).not.toHaveBeenCalled();
  });

  it("returns failed when marking the email verified throws", async () => {
    // Arrange
    vi.mocked(takeVerificationAttempt).mockResolvedValue(liveAttempt());
    vi.mocked(markEmailAsVerified).mockRejectedValue(new Error("db down"));

    // Act
    const state = await verifyEmail({ status: "idle" }, formData(verification));

    // Assert
    expect(state).toEqual({ status: "failed" });
    expect(grantEmailVerificationBonus).not.toHaveBeenCalled();
  });
});

describe("resendVerificationCode", () => {
  const resendRequest = { email: USER_EMAIL };

  it("returns rate_limited with the cooldown and sends nothing", async () => {
    // Arrange
    vi.mocked(checkVerificationResendRateLimit).mockResolvedValue({
      success: false,
      reset: RATE_LIMIT_RESET_AT,
    });

    // Act
    const state = await resendVerificationCode(
      { status: "idle" },
      formData(resendRequest)
    );

    // Assert
    expect(state).toEqual({
      status: "rate_limited",
      cooldownSeconds: COOLDOWN_SECONDS,
    });
    expect(checkVerificationResendRateLimit).toHaveBeenCalledWith(USER_EMAIL);
    expect(getRateLimitResetSeconds).toHaveBeenCalledWith(RATE_LIMIT_RESET_AT);
    expect(getUserByEmail).not.toHaveBeenCalled();
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });

  it.each<[string, User | null]>([
    ["an unknown email", null],
    ["an already verified email", userRow({ emailVerified: true })],
  ])(
    "returns success for %s without sending an email",
    async (_label, userByEmail) => {
      // Arrange
      vi.mocked(getUserByEmail).mockResolvedValue(userByEmail);

      // Act
      const state = await resendVerificationCode(
        { status: "idle" },
        formData(resendRequest)
      );

      // Assert
      expect(state).toEqual({ status: "success" });
      expect(sendVerificationEmail).not.toHaveBeenCalled();
    }
  );

  it("returns success and sends the email to an unverified user", async () => {
    // Arrange
    vi.mocked(getUserByEmail).mockResolvedValue(userRow());

    // Act
    const state = await resendVerificationCode(
      { status: "idle" },
      formData(resendRequest)
    );

    // Assert
    expect(state).toEqual({ status: "success" });
    expect(sendVerificationEmail).toHaveBeenCalledTimes(1);
    expect(sendVerificationEmail).toHaveBeenCalledWith({ email: USER_EMAIL });
  });

  it("returns failed when the sender reports a failure", async () => {
    // Arrange
    vi.mocked(getUserByEmail).mockResolvedValue(userRow());
    vi.mocked(sendVerificationEmail).mockResolvedValue({
      success: false,
      error: "resend rejected the message",
    });

    // Act
    const state = await resendVerificationCode(
      { status: "idle" },
      formData(resendRequest)
    );

    // Assert
    expect(state).toEqual({ status: "failed" });
  });

  it("returns invalid_data for a malformed email before checking the rate limit", async () => {
    // Act
    const state = await resendVerificationCode(
      { status: "idle" },
      formData({ email: "not-an-email" })
    );

    // Assert
    expect(state).toEqual({ status: "invalid_data" });
    expect(checkVerificationResendRateLimit).not.toHaveBeenCalled();
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("returns failed when the user lookup throws", async () => {
    // Arrange
    vi.mocked(getUserByEmail).mockRejectedValue(new Error("db down"));

    // Act
    const state = await resendVerificationCode(
      { status: "idle" },
      formData(resendRequest)
    );

    // Assert
    expect(state).toEqual({ status: "failed" });
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });
});

describe("requestPasswordReset", () => {
  const resetRequest = { email: USER_EMAIL };

  it("returns rate_limited with the minutes until reset and sends nothing", async () => {
    // Arrange
    vi.mocked(checkPasswordResetRateLimit).mockResolvedValue({
      success: false,
      reset: RATE_LIMIT_RESET_AT,
    });

    // Act
    const state = await requestPasswordReset(
      { status: "idle" },
      formData(resetRequest)
    );

    // Assert
    expect(state).toEqual({
      status: "rate_limited",
      resetMinutes: RESET_MINUTES,
    });
    expect(checkPasswordResetRateLimit).toHaveBeenCalledWith(USER_EMAIL);
    expect(getRateLimitResetMinutes).toHaveBeenCalledWith(RATE_LIMIT_RESET_AT);
    expect(getUserByEmail).not.toHaveBeenCalled();
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("returns success for an unknown email without storing a token or sending", async () => {
    // Act
    const state = await requestPasswordReset(
      { status: "idle" },
      formData(resetRequest)
    );

    // Assert
    expect(state).toEqual({ status: "success" });
    expect(getUserByEmail).toHaveBeenCalledWith(USER_EMAIL);
    expect(setPasswordResetToken).not.toHaveBeenCalled();
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("stores the hash of the token and emails the plain token to a known user", async () => {
    // Arrange
    vi.mocked(getUserByEmail).mockResolvedValue(userRow());

    // Act
    const state = await requestPasswordReset(
      { status: "idle" },
      formData(resetRequest)
    );

    // Assert
    expect(state).toEqual({ status: "success" });
    expect(setPasswordResetToken).toHaveBeenCalledTimes(1);
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    const [storedToken] = vi.mocked(setPasswordResetToken).mock.calls[0];
    const [sentEmail] = vi.mocked(sendPasswordResetEmail).mock.calls[0];
    expect(storedToken.userId).toBe(USER_ID);
    expect(storedToken.hashedToken).toMatch(SHA256_HEX_PATTERN);
    expect(storedToken.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(sentEmail.email).toBe(USER_EMAIL);
    expect(sentEmail.resetToken).not.toBe(storedToken.hashedToken);
    expect(sha256Hex(sentEmail.resetToken)).toBe(storedToken.hashedToken);
  });

  it("returns failed when the sender reports a failure", async () => {
    // Arrange
    vi.mocked(getUserByEmail).mockResolvedValue(userRow());
    vi.mocked(sendPasswordResetEmail).mockResolvedValue({
      success: false,
      error: "resend rejected the message",
    });

    // Act
    const state = await requestPasswordReset(
      { status: "idle" },
      formData(resetRequest)
    );

    // Assert
    expect(state).toEqual({ status: "failed" });
    expect(setPasswordResetToken).toHaveBeenCalledTimes(1);
  });

  it("returns invalid_data for a malformed email before checking the rate limit", async () => {
    // Act
    const state = await requestPasswordReset(
      { status: "idle" },
      formData({ email: "not-an-email" })
    );

    // Assert
    expect(state).toEqual({ status: "invalid_data" });
    expect(checkPasswordResetRateLimit).not.toHaveBeenCalled();
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("returns failed and sends nothing when storing the token throws", async () => {
    // Arrange
    vi.mocked(getUserByEmail).mockResolvedValue(userRow());
    vi.mocked(setPasswordResetToken).mockRejectedValue(new Error("db down"));

    // Act
    const state = await requestPasswordReset(
      { status: "idle" },
      formData(resetRequest)
    );

    // Assert
    expect(state).toEqual({ status: "failed" });
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });
});

describe("resetPassword", () => {
  const passwordReset = { token: RESET_TOKEN, password: STRONG_PASSWORD };

  it("returns invalid_token when no user matches the hashed token", async () => {
    // Act
    const state = await resetPassword(
      { status: "idle" },
      formData(passwordReset)
    );

    // Assert
    expect(state).toEqual({ status: "invalid_token" });
    expect(getUserByResetToken).toHaveBeenCalledWith({
      hashedToken: sha256Hex(RESET_TOKEN),
    });
    expect(updateUserPassword).not.toHaveBeenCalled();
    expect(sendPasswordChangedEmail).not.toHaveBeenCalled();
  });

  it("returns success, stores the hashed password and sends the changed email", async () => {
    // Arrange
    vi.mocked(getUserByResetToken).mockResolvedValue(userRow());

    // Act
    const state = await resetPassword(
      { status: "idle" },
      formData(passwordReset)
    );

    // Assert
    expect(state).toEqual({ status: "success" });
    expect(generateHashedPassword).toHaveBeenCalledWith(STRONG_PASSWORD);
    expect(updateUserPassword).toHaveBeenCalledTimes(1);
    expect(updateUserPassword).toHaveBeenCalledWith({
      userId: USER_ID,
      hashedPassword: HASHED_PASSWORD,
    });
    expect(sendPasswordChangedEmail).toHaveBeenCalledTimes(1);
    expect(sendPasswordChangedEmail).toHaveBeenCalledWith({
      email: USER_EMAIL,
    });
  });

  it("returns success even when the password-changed email reports a failure", async () => {
    // Arrange
    vi.mocked(getUserByResetToken).mockResolvedValue(userRow());
    vi.mocked(sendPasswordChangedEmail).mockResolvedValue({
      success: false,
      error: "resend rejected the message",
    });

    // Act
    const state = await resetPassword(
      { status: "idle" },
      formData(passwordReset)
    );

    // Assert
    expect(state).toEqual({ status: "success" });
    expect(updateUserPassword).toHaveBeenCalledTimes(1);
  });

  it.each<[string, Record<string, string>]>([
    ["an empty token", { token: "", password: STRONG_PASSWORD }],
    ["a missing token", { password: STRONG_PASSWORD }],
    ["a weak password", { token: RESET_TOKEN, password: "weakpass" }],
  ])(
    "returns invalid_data for %s and looks up no token",
    async (_label, fields) => {
      // Act
      const state = await resetPassword({ status: "idle" }, formData(fields));

      // Assert
      expect(state).toEqual({ status: "invalid_data" });
      expect(getUserByResetToken).not.toHaveBeenCalled();
      expect(updateUserPassword).not.toHaveBeenCalled();
    }
  );

  it("returns failed and sends no email when updating the password throws", async () => {
    // Arrange
    vi.mocked(getUserByResetToken).mockResolvedValue(userRow());
    vi.mocked(updateUserPassword).mockRejectedValue(new Error("db down"));

    // Act
    const state = await resetPassword(
      { status: "idle" },
      formData(passwordReset)
    );

    // Assert
    expect(state).toEqual({ status: "failed" });
    expect(sendPasswordChangedEmail).not.toHaveBeenCalled();
  });
});
