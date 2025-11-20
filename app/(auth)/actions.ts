"use server";

import { z } from "zod";

import { assignTesterPlan } from "@/lib/ai/subscription-init";
import { createPasswordResetToken, hashToken } from "@/lib/auth/reset-token";
import {
  createUser,
  getUser,
  getUserByResetToken,
  getUserByVerificationCode,
  markEmailAsVerified,
  setPasswordResetToken,
  updateUserPassword,
} from "@/lib/db/queries";
import { generateHashedPassword } from "@/lib/db/utils";
import { sendPasswordChangedEmail } from "@/lib/email/send-password-changed";
import { sendPasswordResetEmail } from "@/lib/email/send-password-reset";
import { sendVerificationEmail } from "@/lib/email/send-verification-email";
import {
  checkPasswordResetRateLimit,
  checkVerificationResendRateLimit,
  getRateLimitResetMinutes,
  getRateLimitResetSeconds,
} from "@/lib/rate-limit";

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
  status: "idle" | "in_progress" | "success" | "failed" | "invalid_data";
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

    const result = await signIn("credentials", {
      email: validatedData.email,
      password: validatedData.password,
      redirect: false,
    });

    if (result?.error || result?.ok === false) {
      return { status: "failed" };
    }

    return { status: "success" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { status: "invalid_data" };
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
    | "invalid_data";
  email?: string;
};

export const register = async (
  _: RegisterActionState,
  formData: FormData
): Promise<RegisterActionState> => {
  try {
    const validatedData = registerFormSchema.parse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    const locale = (formData.get("locale") as string) || "en";

    const [existingUser] = await getUser(validatedData.email);

    if (existingUser) {
      return { status: "user_exists" } as RegisterActionState;
    }

    const newUser = await createUser(
      validatedData.email,
      validatedData.password,
      locale
    );

    // Assign tester plan to new user
    try {
      await assignTesterPlan(newUser.id);
    } catch (error) {
      console.error("Failed to assign tester plan:", error);
      // Continue with registration even if plan assignment fails
    }

    // Send verification email
    const emailResult = await sendVerificationEmail({
      email: validatedData.email,
      locale,
    });

    if (!emailResult.success) {
      console.error("Failed to send verification email:", emailResult.error);
      return { status: "failed" };
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

    // Hash the code to match database storage
    const hashedCode = hashToken(validatedData.code);

    // Find user by verification code and check expiry
    const foundUser = await getUserByVerificationCode({ hashedCode });

    if (!foundUser) {
      console.error("[VerifyEmail]User not found");
      return { status: "invalid_code" };
    }

    // Verify the email matches
    if (foundUser.email !== validatedData.email) {
      console.error("[VerifyEmail] Email mismatch");
      return { status: "invalid_code" };
    }

    // Mark email as verified
    await markEmailAsVerified({ email: validatedData.email });

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
  locale: z.string().optional().default("en"),
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
      locale: formData.get("locale"),
    });

    // Check rate limit (60 seconds cooldown)
    const rateLimitResult = await checkVerificationResendRateLimit(
      validatedData.email
    );
    if (!rateLimitResult.success) {
      return {
        status: "rate_limited",
        cooldownSeconds: getRateLimitResetSeconds(rateLimitResult.reset),
      };
    }

    // Check if user exists and is not already verified
    const [foundUser] = await getUser(validatedData.email);

    // Always return success to prevent email enumeration
    if (!foundUser || foundUser.emailVerified) {
      return { status: "success" };
    }

    // Send new verification email using user's preferred language
    const emailResult = await sendVerificationEmail({
      email: validatedData.email,
      locale: foundUser.preferredLanguage || "en",
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
  locale: z.string().optional().default("en"),
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
      locale: formData.get("locale"),
    });

    // Check rate limit
    const rateLimitResult = await checkPasswordResetRateLimit(
      validatedData.email
    );
    if (!rateLimitResult.success) {
      return {
        status: "rate_limited",
        resetMinutes: getRateLimitResetMinutes(rateLimitResult.reset),
      };
    }

    // Find user by email
    const [foundUser] = await getUser(validatedData.email);

    // Always return success to prevent email enumeration
    // Even if user doesn't exist, we pretend we sent the email
    if (!foundUser) {
      return { status: "success" };
    }

    // Generate reset token
    const { token, hashedToken, expiresAt } = createPasswordResetToken();

    // Store hashed token in database
    await setPasswordResetToken({
      userId: foundUser.id,
      hashedToken,
      expiresAt,
    });

    // Send email with reset link
    const emailResult = await sendPasswordResetEmail({
      email: validatedData.email,
      resetToken: token, // Send plain token in email
      locale: validatedData.locale,
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
  locale: z.string().optional().default("en"),
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
      locale: formData.get("locale"),
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
      locale: validatedData.locale,
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
