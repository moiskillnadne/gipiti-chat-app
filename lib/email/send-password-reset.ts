import { emailConfig, resend } from "./client";
import {
  getPasswordResetEmailHtml,
  getPasswordResetEmailSubject,
  getPasswordResetEmailText,
} from "./templates/password-reset";

type SendPasswordResetEmailParams = {
  email: string;
  resetToken: string;
  locale: string;
};

/**
 * Send password reset email with reset link
 * @param params Email address, reset token, and locale
 * @returns Resend API response
 */
export async function sendPasswordResetEmail({
  email,
  resetToken,
  locale = "en",
}: SendPasswordResetEmailParams): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Construct reset URL
    const resetUrl = `${emailConfig.appUrl}/reset-password?token=${resetToken}`;

    // Get localized subject
    const subject = getPasswordResetEmailSubject(locale);

    // Generate email HTML and text
    const html = getPasswordResetEmailHtml({
      resetUrl,
      email,
      locale,
    });

    const text = getPasswordResetEmailText({
      resetUrl,
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
      console.error("Failed to send password reset email:", response.error);
      return {
        success: false,
        error: response.error.message,
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error sending password reset email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
