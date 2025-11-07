import { emailConfig, resend } from "./client";
import {
  getPasswordChangedEmailHtml,
  getPasswordChangedEmailSubject,
  getPasswordChangedEmailText,
} from "./templates/password-changed";

type SendPasswordChangedEmailParams = {
  email: string;
  locale: string;
};

/**
 * Send password changed confirmation email
 * @param params Email address and locale
 * @returns Resend API response
 */
export async function sendPasswordChangedEmail({
  email,
  locale = "en",
}: SendPasswordChangedEmailParams): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Construct forgot password URL for security purposes
    const resetUrl = `${emailConfig.appUrl}/forgot-password`;

    // Get localized subject
    const subject = getPasswordChangedEmailSubject(locale);

    // Generate email HTML and text
    const html = getPasswordChangedEmailHtml({
      locale,
      timestamp: new Date(),
      resetUrl,
    });

    const text = getPasswordChangedEmailText({
      locale,
      timestamp: new Date(),
      resetUrl,
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
