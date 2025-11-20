import { emailConfig } from "../client";

type EmailVerificationProps = {
  code: string;
  email: string;
  locale: string;
};

type LocaleContent = {
  subject: string;
  greeting: string;
  bodyText: string;
  codeLabel: string;
  expiryNotice: string;
  securityNotice: string;
  ignoreText: string;
  supportText: string;
};

const content: Record<string, LocaleContent> = {
  en: {
    subject: "Verify your email address",
    greeting: "Welcome!",
    bodyText:
      "Thank you for registering. Please use the following verification code to complete your registration:",
    codeLabel: "Verification Code",
    expiryNotice: "This code will expire in 30 minutes.",
    securityNotice:
      "If you didn't create an account, please ignore this email.",
    ignoreText:
      "Someone may have entered your email by mistake. No action is needed.",
    supportText: "Need help? Contact our support team.",
  },
  ru: {
    subject: "Подтвердите ваш email",
    greeting: "Добро пожаловать!",
    bodyText:
      "Спасибо за регистрацию. Пожалуйста, используйте следующий код для завершения регистрации:",
    codeLabel: "Код подтверждения",
    expiryNotice: "Этот код действителен в течение 30 минут.",
    securityNotice:
      "Если вы не создавали аккаунт, просто проигнорируйте это письмо.",
    ignoreText:
      "Возможно, кто-то ввел ваш email по ошибке. Никаких действий не требуется.",
    supportText: "Нужна помощь? Свяжитесь с нашей службой поддержки.",
  },
};

export function getEmailVerificationSubject(locale: string): string {
  return content[locale]?.subject || content.en.subject;
}

export function getEmailVerificationHtml({
  code,
  locale,
}: EmailVerificationProps): string {
  const t = content[locale] || content.en;

  return `
<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t.subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f6f6f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">

          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #1a1a1a;">
                ${t.subject}
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 0 40px 40px 40px;">
              <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 24px; color: #4a4a4a;">
                ${t.greeting}
              </p>
              <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 24px; color: #4a4a4a;">
                ${t.bodyText}
              </p>

              <!-- Code Display -->
              <table role="presentation" style="margin: 32px 0; width: 100%;">
                <tr>
                  <td align="center">
                    <p style="margin: 0 0 8px 0; font-size: 14px; color: #6a6a6a;">
                      ${t.codeLabel}
                    </p>
                    <div style="display: inline-block; padding: 16px 32px; background-color: #f8f9fa; border: 2px dashed #dee2e6; border-radius: 8px;">
                      <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #0070f3; font-family: monospace;">
                        ${code}
                      </span>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Expiry Notice -->
              <p style="margin: 24px 0 0 0; padding: 16px; background-color: #fff4e6; border-left: 4px solid #ff9500; font-size: 14px; line-height: 20px; color: #8b5a00; border-radius: 4px;">
                ${t.expiryNotice}
              </p>

              <!-- Security Notice -->
              <p style="margin: 24px 0 0 0; font-size: 14px; line-height: 20px; color: #6a6a6a;">
                ${t.securityNotice}
              </p>
              <p style="margin: 8px 0 0 0; font-size: 14px; line-height: 20px; color: #6a6a6a;">
                ${t.ignoreText}
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 32px 40px; border-top: 1px solid #e6e6e6; text-align: center;">
              <p style="margin: 0; font-size: 14px; line-height: 20px; color: #8a8a8a;">
                ${t.supportText}
              </p>
              <p style="margin: 8px 0 0 0; font-size: 12px; line-height: 18px; color: #a0a0a0;">
                ${emailConfig.supportEmail}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export function getEmailVerificationText({
  code,
  email,
  locale,
}: EmailVerificationProps): string {
  const t = content[locale] || content.en;

  return `
${t.subject}

${t.greeting}

${t.bodyText}

${t.codeLabel}: ${code}

${t.expiryNotice}

${t.securityNotice}
${t.ignoreText}

${t.supportText}
${email}
  `.trim();
}
