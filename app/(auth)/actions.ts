"use server";

import { cookies, headers } from "next/headers";
import { z } from "zod";
import { isDisposableEmail } from "@/lib/auth/disposable-email-domains";
import {
  createPasswordResetToken,
  hashToken,
  verifyToken,
} from "@/lib/auth/reset-token";
import { isRateLimitedSignInError } from "@/lib/auth/sign-in-error-codes";
import { grantEmailVerificationBonus } from "@/lib/billing/balance";
import { getUserByEmail } from "@/lib/db/query/user/get-by-email";
import { getUserByResetToken } from "@/lib/db/query/user/get-user-by-reset-token";
import { markEmailAsVerified } from "@/lib/db/query/user/mark-email-as-verified";
import {
  MAX_EMAIL_VERIFICATION_ATTEMPTS,
  takeVerificationAttempt,
} from "@/lib/db/query/user/take-verification-attempt";
import { updateUserPassword } from "@/lib/db/query/user/update-user-password";
import { sendPasswordChangedEmail } from "@/lib/email/send-password-changed";
import { sendPasswordResetEmail } from "@/lib/email/send-password-reset";
import { sendVerificationEmail } from "@/lib/email/send-verification-email";
import {
  getRegistrationGeoFromHeaders,
  sanitizeLanguage,
} from "@/lib/geo/registration-geo";
import { UTM_COOKIE_NAME } from "@/lib/utm/constants";
import { parseUtmCookie } from "@/lib/utm/parse-utm-cookie";
import { generateHashedPassword } from "@/server/db/utils";
import { isSignupEnabled } from "@/server/flags";
import { getClientIp } from "@/server/http/client-ip";
import {
  checkPasswordResetRateLimit,
  checkRegisterRateLimit,
  checkVerificationAttemptRateLimit,
  checkVerificationResendRateLimit,
  getRateLimitResetMinutes,
  getRateLimitResetSeconds,
} from "@/server/http/rate-limit";
import {
  createUser,
  DuplicateEmailError,
} from "../../lib/db/query/user/create-user";
import { setPasswordResetToken } from "../../lib/db/query/user/set-password-reset-token";
import { signIn } from "./auth";

// Login schema - less strict to allow existing users with older passwords
const loginFormSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Registration schema - strict password requirements for new users
const registerFormSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(
      /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/,
      "Password must contain at least one special character"
    ),
});

export type LoginActionState = {
  status:
    | "idle"
    | "in_progress"
    | "success"
    | "failed"
    | "rate_limited"
    | "invalid_data";
};

/** Where the Auth.js routes are served (`app/(auth)/api/auth/[...nextauth]`). */
const AUTH_ROUTES_PATH_PREFIX = "/api/auth/";

/**
 * Auth.js answers with absolute URLs; this base only lets a relative one be
 * parsed. Its host is never read.
 */
const RELATIVE_URL_BASE = "http://localhost";

/**
 * What `signIn(..., { redirect: false })` resolves with: the URL Auth.js would
 * have redirected to. The object shape is what the client-side `signIn`
 * answers; the server one never does, but `login` has always handled it.
 */
type SignInOutcome = string | { error?: string; ok?: boolean } | undefined;

/**
 * Whether a resolved `signIn` ended without a session.
 *
 * `signIn` throws for the failures Auth.js expects (a wrong password, an
 * error inside `authorize`), but it resolves for the rest:
 * - an error thrown outside the credentials callback is turned into a
 *   redirect to the error page, `/api/auth/error?error=Configuration`;
 * - a request Auth.js refuses before `authorize` runs (untrusted host, a
 *   broken `authjs.callback-url` cookie) gets an answer with no `Location`,
 *   and `signIn` falls back to the URL it posted to,
 *   `/api/auth/callback/credentials`.
 * A successful sign-in resolves with the page the form was posted from, or
 * `/`. So the signal is the path: a URL inside the Auth.js routes is never
 * where a signed-in user is sent. The `error` query parameter is not used
 * because it is missing in the second case and present after a successful
 * sign-in from `/login?error=...`. If `pages.error` is ever configured in
 * `auth.config.ts`, that path has to be recognised here as well.
 */
const hasSignInEndedWithoutSession = (outcome: SignInOutcome): boolean => {
  if (typeof outcome !== "string") {
    return Boolean(outcome?.error) || outcome?.ok === false;
  }

  // A string that is not a URL at all is not a known success.
  if (!URL.canParse(outcome, RELATIVE_URL_BASE)) {
    return true;
  }

  const { pathname } = new URL(outcome, RELATIVE_URL_BASE);

  return pathname.startsWith(AUTH_ROUTES_PATH_PREFIX);
};

export const login = async (
  _: LoginActionState,
  formData: FormData
): Promise<LoginActionState> => {
  try {
    const validatedData = loginFormSchema.parse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    const outcome: SignInOutcome = await signIn("credentials", {
      email: validatedData.email,
      password: validatedData.password,
      redirect: false,
    });

    if (hasSignInEndedWithoutSession(outcome)) {
      return { status: "failed" };
    }

    return { status: "success" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { status: "invalid_data" };
    }

    if (isRateLimitedSignInError(error)) {
      return { status: "rate_limited" };
    }

    return { status: "failed" };
  }
};

export type RegisterActionState = {
  status:
    | "idle"
    | "in_progress"
    | "success"
    | "failed"
    | "user_exists"
    | "rate_limited"
    | "disposable_email"
    | "invalid_data";
  email?: string;
};

export const register = async (
  _: RegisterActionState,
  formData: FormData
): Promise<RegisterActionState> => {
  try {
    // Signup can be disabled remotely via the isSignupEnabled Vercel flag
    if (!(await isSignupEnabled())) {
      return { status: "failed" };
    }

    const validatedData = registerFormSchema.parse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    const rateLimitResult = await checkRegisterRateLimit(
      getClientIp(await headers())
    );
    if (rateLimitResult.isUnavailable) {
      return { status: "failed" };
    }
    if (!rateLimitResult.success) {
      return { status: "rate_limited" };
    }

    if (isDisposableEmail(validatedData.email)) {
      return { status: "disposable_email" };
    }

    const userRecord = await getUserByEmail(validatedData.email);

    if (userRecord) {
      return { status: "user_exists" } as RegisterActionState;
    }

    // Read UTM attribution from cookie
    const cookieStore = await cookies();
    const utmCookie = cookieStore.get(UTM_COOKIE_NAME)?.value;
    const utmData = parseUtmCookie(
      utmCookie ? decodeURIComponent(utmCookie) : undefined
    );

    // Capture where the user signed up from: country/region/city from the
    // Vercel edge IP headers, plus the browser language from a hidden field.
    const geoHeaders = await getRegistrationGeoFromHeaders(headers);
    const language = sanitizeLanguage(formData.get("language"));

    await createUser(
      validatedData.email,
      validatedData.password,
      utmData ?? undefined,
      { ...geoHeaders, language }
    );

    // Clear UTM cookie after attribution
    if (utmCookie) {
      cookieStore.delete(UTM_COOKIE_NAME);
    }

    // Auto sign-in the user (middleware will redirect to verify-email)
    await signIn("credentials", {
      email: validatedData.email,
      password: validatedData.password,
      redirect: false,
    });

    return { status: "success" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { status: "invalid_data" };
    }

    // Lost the race against a concurrent signup with the same address — the
    // unique index rejected the insert. Same outcome as the pre-check above.
    if (error instanceof DuplicateEmailError) {
      return { status: "user_exists" };
    }

    // Surface the real cause instead of swallowing it behind "failed" —
    // a silent catch here is what hid the geo-headers crash (GIPITI-87).
    console.error("Error in register:", error);
    return { status: "failed" };
  }
};

// Verify email schema
const verifyEmailFormSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6, "Code must be 6 digits"),
});

export type VerifyEmailActionState = {
  status:
    | "idle"
    | "in_progress"
    | "success"
    | "failed"
    | "invalid_code"
    | "expired_code"
    | "already_verified"
    | "invalid_data";
};

/**
 * Why a code could not be checked for this email: the account is already
 * verified, its code is dead (expired, or its attempts are used up), or there
 * is nothing to check against.
 */
const getStatusWithoutLiveCode = async (
  email: string
): Promise<"already_verified" | "expired_code" | "invalid_code"> => {
  const userRecord = await getUserByEmail(email);

  if (userRecord?.emailVerified) {
    return "already_verified";
  }

  return userRecord?.emailVerificationCode ? "expired_code" : "invalid_code";
};

export const verifyEmail = async (
  _: VerifyEmailActionState,
  formData: FormData
): Promise<VerifyEmailActionState> => {
  try {
    const validatedData = verifyEmailFormSchema.parse({
      email: formData.get("email"),
      code: formData.get("code"),
    });

    const rateLimitResult = await checkVerificationAttemptRateLimit(
      validatedData.email
    );
    if (!rateLimitResult.success) {
      return { status: "failed" };
    }

    // Takes one of the code's attempts whether the guess is right or wrong;
    // see `takeVerificationAttempt` for why it is taken first.
    const attempt = await takeVerificationAttempt({
      email: validatedData.email,
    });

    if (!attempt) {
      return { status: await getStatusWithoutLiveCode(validatedData.email) };
    }

    if (!verifyToken(validatedData.code, attempt.hashedCode)) {
      const isLastAttempt =
        attempt.attemptsUsed >= MAX_EMAIL_VERIFICATION_ATTEMPTS;
      return { status: isLastAttempt ? "expired_code" : "invalid_code" };
    }

    // Mark email as verified
    await markEmailAsVerified({ email: validatedData.email });

    // Credit the one-time email-confirmation bonus. Best-effort and idempotent:
    // verification has already succeeded, so a bonus failure must not block it.
    try {
      await grantEmailVerificationBonus(attempt.userId);
    } catch (bonusError) {
      console.error("Failed to grant email verification bonus:", bonusError);
    }

    return { status: "success" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { status: "invalid_data" };
    }

    console.error("Error in verifyEmail:", error);
    return { status: "failed" };
  }
};

// Resend verification code schema
const resendVerificationFormSchema = z.object({
  email: z.string().email(),
});

export type ResendVerificationActionState = {
  status:
    | "idle"
    | "in_progress"
    | "success"
    | "failed"
    | "rate_limited"
    | "invalid_data";
  cooldownSeconds?: number;
};

export const resendVerificationCode = async (
  _: ResendVerificationActionState,
  formData: FormData
): Promise<ResendVerificationActionState> => {
  try {
    const validatedData = resendVerificationFormSchema.parse({
      email: formData.get("email"),
    });

    // Check rate limit (60 seconds cooldown)
    const rateLimitResult = await checkVerificationResendRateLimit(
      validatedData.email
    );
    if (rateLimitResult.isUnavailable) {
      return { status: "failed" };
    }
    if (!rateLimitResult.success) {
      return {
        status: "rate_limited",
        cooldownSeconds: getRateLimitResetSeconds(rateLimitResult.reset),
      };
    }

    // Check if user exists and is not already verified
    const userRecord = await getUserByEmail(validatedData.email);

    // Always return success to prevent email enumeration
    if (!userRecord || userRecord.emailVerified) {
      return { status: "success" };
    }

    // Send new verification email
    const emailResult = await sendVerificationEmail({
      email: validatedData.email,
    });

    if (!emailResult.success) {
      console.error("Failed to resend verification email:", emailResult.error);
      return { status: "failed" };
    }

    return { status: "success" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { status: "invalid_data" };
    }

    console.error("Error in resendVerificationCode:", error);
    return { status: "failed" };
  }
};

// Forgot password schema
const forgotPasswordFormSchema = z.object({
  email: z.string().email(),
});

export type ForgotPasswordActionState = {
  status:
    | "idle"
    | "in_progress"
    | "success"
    | "failed"
    | "rate_limited"
    | "invalid_data";
  resetMinutes?: number;
};

export const requestPasswordReset = async (
  _: ForgotPasswordActionState,
  formData: FormData
): Promise<ForgotPasswordActionState> => {
  try {
    const validatedData = forgotPasswordFormSchema.parse({
      email: formData.get("email"),
    });

    // Check rate limit
    const rateLimitResult = await checkPasswordResetRateLimit(
      validatedData.email
    );
    if (rateLimitResult.isUnavailable) {
      return { status: "failed" };
    }
    if (!rateLimitResult.success) {
      return {
        status: "rate_limited",
        resetMinutes: getRateLimitResetMinutes(rateLimitResult.reset),
      };
    }

    // Find user by email
    const userRecord = await getUserByEmail(validatedData.email);

    // Always return success to prevent email enumeration
    // Even if user doesn't exist, we pretend we sent the email
    if (!userRecord) {
      return { status: "success" };
    }

    // Generate reset token
    const { token, hashedToken, expiresAt } = createPasswordResetToken();

    // Store hashed token in database
    await setPasswordResetToken({
      userId: userRecord.id,
      hashedToken,
      expiresAt,
    });

    // Send email with reset link
    const emailResult = await sendPasswordResetEmail({
      email: validatedData.email,
      resetToken: token, // Send plain token in email
    });

    if (!emailResult.success) {
      console.error("Failed to send password reset email:", emailResult.error);
      return { status: "failed" };
    }

    return { status: "success" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { status: "invalid_data" };
    }

    console.error("Error in requestPasswordReset:", error);
    return { status: "failed" };
  }
};

// Reset password schema
const resetPasswordFormSchema = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(
      /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/,
      "Password must contain at least one special character"
    ),
});

export type ResetPasswordActionState = {
  status:
    | "idle"
    | "in_progress"
    | "success"
    | "failed"
    | "invalid_token"
    | "invalid_data";
};

export const resetPassword = async (
  _: ResetPasswordActionState,
  formData: FormData
): Promise<ResetPasswordActionState> => {
  try {
    const validatedData = resetPasswordFormSchema.parse({
      token: formData.get("token"),
      password: formData.get("password"),
    });

    // Hash the token to match database storage
    const hashedToken = hashToken(validatedData.token);

    // Find user by reset token and check expiry
    const foundUser = await getUserByResetToken({ hashedToken });

    if (!foundUser) {
      return { status: "invalid_token" };
    }

    // Hash new password
    const hashedPassword = generateHashedPassword(validatedData.password);

    // Update password and clear reset token
    await updateUserPassword({
      userId: foundUser.id,
      hashedPassword,
    });

    // Send confirmation email
    await sendPasswordChangedEmail({
      email: foundUser.email,
    });

    return { status: "success" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { status: "invalid_data" };
    }

    console.error("Error in resetPassword:", error);
    return { status: "failed" };
  }
};
