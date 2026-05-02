import { emailConfig, resend } from "./client";
import {
  getPasswordResetEmailHtml,
  getPasswordResetEmailSubject,
  getPasswordResetEmailText,
} from "./templates/password-reset";

type SendPasswordResetEmailParams = {
  email: string;
  resetToken: string;
};

/**
 * Send password reset email with reset link
 * @param params Email address and reset token
 * @returns Resend API response
 */
export async function sendPasswordResetEmail({
  email,
  resetToken,
}: SendPasswordResetEmailParams): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const resetUrl = `${emailConfig.appUrl}/reset-password?token=${resetToken}`;

    const subject = getPasswordResetEmailSubject();

    const html = getPasswordResetEmailHtml({
      resetUrl,
      email,
    });

    const text = getPasswordResetEmailText({
      resetUrl,
      email,
    });

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
