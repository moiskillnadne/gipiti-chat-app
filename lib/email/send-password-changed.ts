import { emailConfig, resend } from "./client";
import {
  getPasswordChangedEmailHtml,
  getPasswordChangedEmailSubject,
  getPasswordChangedEmailText,
} from "./templates/password-changed";

type SendPasswordChangedEmailParams = {
  email: string;
};

/**
 * Send password changed confirmation email
 * @param params Email address
 * @returns Resend API response
 */
export async function sendPasswordChangedEmail({
  email,
}: SendPasswordChangedEmailParams): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const resetUrl = `${emailConfig.appUrl}/forgot-password`;

    const subject = getPasswordChangedEmailSubject();

    const html = getPasswordChangedEmailHtml({
      timestamp: new Date(),
      resetUrl,
    });

    const text = getPasswordChangedEmailText({
      timestamp: new Date(),
      resetUrl,
    });

    const response = await resend.emails.send({
      from: emailConfig.from,
      to: email,
      subject,
      html,
      text,
    });

    if (response.error) {
      console.error("Failed to send password changed email:", response.error);
      return {
        success: false,
        error: response.error.message,
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error sending password changed email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
