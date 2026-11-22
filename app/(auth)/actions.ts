"use server";

import { cookies, headers } from "next/headers";
import { z } from "zod";
import { UTM_COOKIE_NAME } from "@/lib/utm/constants";
import { isSignupEnabled } from "@/server/flags";
import { getClientIp } from "@/server/http/client-ip";
import {
  getRateLimitResetMinutes,
  getRateLimitResetSeconds,
} from "@/server/http/rate-limit";
import { signIn } from "@/server/modules/auth/next-auth";
import {
  decodeUtmCookieValue,
  parseUtmCookie,
} from "@/server/modules/auth/parse-utm-cookie";
import { isAcceptablePassword } from "@/server/modules/auth/password-policy";
import { registerUser } from "@/server/modules/auth/register-user";
import {
  getRegistrationGeoFromHeaders,
  sanitizeLanguage,
} from "@/server/modules/auth/registration-geo";
import { requestPasswordReset as requestPasswordResetForEmail } from "@/server/modules/auth/request-password-reset";
import { resetPassword as resetPasswordWithToken } from "@/server/modules/auth/reset-password";
import { sendVerificationCode } from "@/server/modules/auth/send-verification-code";
import { isRateLimitedSignInError } from "@/server/modules/auth/sign-in-error-codes";
import {
  hasSignInEndedWithoutSession,
  type SignInOutcome,
} from "@/server/modules/auth/sign-in-outcome";
import { verifyEmailCode } from "@/server/modules/auth/verify-email-code";

// The actions in this file are the web forms' side of the auth services in
// `server/modules/auth`: they read the form, the cookies and the request
// headers, call a service, and turn its result into the form's state. The
// rules themselves (limits, checks, what is stored and sent) live in the
// services, which the API calls too.

/**
 * Reached only when a service gains a result that an action does not map
 * yet. The `never` parameter makes that a compile error; the throw, which
 * each action turns into "failed", is for a build that got past it.
 */
const unhandledResult = (result: never): never => {
  throw new Error(`Unhandled auth result: ${JSON.stringify(result)}`);
};

/** A new password must pass the server's rule; see `isAcceptablePassword`. */
const newPasswordSchema = z.string().refine(isAcceptablePassword);

// Login schema - less strict to allow existing users with older passwords
const loginFormSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Registration schema - strict password requirements for new users
const registerFormSchema = z.object({
  email: z.string().email(),
  password: newPasswordSchema,
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
    const validation = registerFormSchema.safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    if (!validation.success) {
      // While sign-up is switched off the form answers "failed" whatever was
      // typed, so the flag is asked before the input is called invalid.
      return {
        status: (await isSignupEnabled()) ? "invalid_data" : "failed",
      };
    }

    const { email, password } = validation.data;

    // Read UTM attribution from cookie
    const cookieStore = await cookies();
    const utmCookie = cookieStore.get(UTM_COOKIE_NAME)?.value;
    const utmData = parseUtmCookie(
      utmCookie ? decodeUtmCookieValue(utmCookie) : undefined
    );

    // Capture where the user signed up from: country/region/city from the
    // Vercel edge IP headers, plus the browser language from a hidden field.
    const geoHeaders = await getRegistrationGeoFromHeaders(headers);
    const language = sanitizeLanguage(formData.get("language"));

    const result = await registerUser({
      email,
      password,
      ip: getClientIp(await headers()),
      utm: utmData ?? undefined,
      geo: { ...geoHeaders, language },
    });

    switch (result.status) {
      case "registered":
        break;
      case "user_exists":
        return { status: "user_exists" };
      case "rate_limited":
        return { status: "rate_limited" };
      case "disposable_email":
        return { status: "disposable_email" };
      case "weak_password":
        return { status: "invalid_data" };
      case "signup_disabled":
      case "limiter_unavailable":
        return { status: "failed" };
      default:
        return unhandledResult(result);
    }

    // Clear UTM cookie after attribution
    if (utmCookie) {
      cookieStore.delete(UTM_COOKIE_NAME);
    }

    // Auto sign-in the user (middleware will redirect to verify-email)
    await signIn("credentials", { email, password, redirect: false });

    return { status: "success" };
  } catch (error) {
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

export const verifyEmail = async (
  _: VerifyEmailActionState,
  formData: FormData
): Promise<VerifyEmailActionState> => {
  try {
    const validatedData = verifyEmailFormSchema.parse({
      email: formData.get("email"),
      code: formData.get("code"),
    });

    const result = await verifyEmailCode(validatedData);

    switch (result.status) {
      case "verified":
        return { status: "success" };
      case "rate_limited":
      case "limiter_unavailable":
        return { status: "failed" };
      case "invalid_code":
      case "expired_code":
      case "already_verified":
        // These are states of the form too.
        return { status: result.status };
      default:
        return unhandledResult(result);
    }
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

    const result = await sendVerificationCode(validatedData);

    switch (result.status) {
      case "rate_limited":
        return {
          status: "rate_limited",
          cooldownSeconds: getRateLimitResetSeconds(result.resetAt),
        };
      case "limiter_unavailable":
      case "send_failed":
        return { status: "failed" };
      case "sent":
      case "unknown_user":
      case "already_verified":
        // The form takes the email from an anonymous visitor, so all three
        // answer success: it must not reveal which emails have an account.
        return { status: "success" };
      default:
        return unhandledResult(result);
    }
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

    const result = await requestPasswordResetForEmail(validatedData);

    switch (result.status) {
      case "rate_limited":
        return {
          status: "rate_limited",
          resetMinutes: getRateLimitResetMinutes(result.resetAt),
        };
      case "limiter_unavailable":
      case "send_failed":
        return { status: "failed" };
      case "sent":
      case "unknown_user":
        // Both answer success, so that the form does not reveal which emails
        // have an account.
        return { status: "success" };
      default:
        return unhandledResult(result);
    }
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
  password: newPasswordSchema,
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

    const result = await resetPasswordWithToken(validatedData);

    switch (result.status) {
      case "password_reset":
        return { status: "success" };
      case "invalid_token":
        return { status: "invalid_token" };
      case "weak_password":
        // Not reachable from the form: its schema applies the same rule.
        return { status: "invalid_data" };
      default:
        return unhandledResult(result);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { status: "invalid_data" };
    }

    console.error("Error in resetPassword:", error);
    return { status: "failed" };
  }
};
