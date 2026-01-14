import { randomInt } from "node:crypto";
import { hashToken } from "../auth/reset-token";
import { setEmailVerificationCode } from "../db/queries";
import { emailConfig, resend } from "./client";
import {
  getEmailVerificationHtml,
  getEmailVerificationSubject,
  getEmailVerificationText,
} from "./templates/email-verification";

type SendVerificationEmailParams = {
  email: string;
  locale: string;
};

/**
 * Generate a cryptographically secure 6-digit verification code
 * @returns 6-digit string code
 */
export function generateVerificationCode(): string {
  const code = randomInt(100_000, 999_999);
  return code.toString();
}

/**
 * Create a verification code with expiry (30 minutes)
 * @returns Object with plain code, hashed code, and expiry date
 */
export function createVerificationCode(): {
  code: string;
  hashedCode: string;
  expiresAt: Date;
} {
  const code = generateVerificationCode();
  const hashedCode = hashToken(code);
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

  return {
    code,
    hashedCode,
    expiresAt,
  };
}

/**
 * Send email verification code
 * @param params Email address and locale
 * @returns Success status and any error message
 */
export async function sendVerificationEmail({
  email,
  locale = "en",
}: SendVerificationEmailParams): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Generate verification code
    const { code, hashedCode, expiresAt } = createVerificationCode();

    // Store hashed code in database
    await setEmailVerificationCode({
      email,
      hashedCode,
      expiresAt,
    });

    // Get localized subject
    const subject = getEmailVerificationSubject(locale);

    // Generate email HTML and text
    const html = getEmailVerificationHtml({
      code,
      email,
      locale,
    });

    const text = getEmailVerificationText({
      code,
      email,
      locale,
    });

    // Send email via Resend
    const response = await resend.emails.send({
      from: emailConfig.from,
      to: email,
      subject,
      html,
      text,
    });

    if (response.error) {
      console.error("Failed to send verification email:", response.error);
      return {
        success: false,
        error: response.error.message,
      };
    }

    console.info(
      `[SendVerificationEmail] Verification email sent successfully to ${email}`
    );

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error sending verification email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
