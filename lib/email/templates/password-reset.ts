type PasswordResetEmailProps = {
  resetUrl: string
  email: string
  locale: string
}

type LocaleContent = {
  subject: string
  greeting: string
  bodyText: string
  buttonText: string
  expiryNotice: string
  securityNotice: string
  ignoreText: string
  supportText: string
}

const content: Record<string, LocaleContent> = {
  en: {
    subject: "Reset your password",
    greeting: "Hello,",
    bodyText:
      "You requested to reset your password. Click the button below to create a new password:",
    buttonText: "Reset Password",
    expiryNotice: "This link will expire in 1 hour.",
    securityNotice:
      "If you didn't request this password reset, please ignore this email.",
    ignoreText:
      "Your password will remain unchanged unless you click the button above.",
    supportText: "Need help? Contact our support team.",
  },
  ru: {
    subject: "Сброс пароля",
    greeting: "Здравствуйте,",
    bodyText:
      "Вы запросили сброс пароля. Нажмите кнопку ниже, чтобы создать новый пароль:",
    buttonText: "Сбросить пароль",
    expiryNotice: "Эта ссылка действительна в течение 1 часа.",
    securityNotice:
      "Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.",
    ignoreText:
      "Ваш пароль останется без изменений, если вы не нажмете кнопку выше.",
    supportText: "Нужна помощь? Свяжитесь с нашей службой поддержки.",
  },
}

export function getPasswordResetEmailSubject(locale: string): string {
  return content[locale]?.subject || content.en.subject
}

export function getPasswordResetEmailHtml({
  resetUrl,
  email,
  locale,
}: PasswordResetEmailProps): string {
  const t = content[locale] || content.en

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

              <!-- Button -->
              <table role="presentation" style="margin: 32px 0; width: 100%;">
                <tr>
                  <td align="center">
                    <a href="${resetUrl}" style="display: inline-block; padding: 14px 32px; background-color: #0070f3; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 500;">
                      ${t.buttonText}
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Expiry Notice -->
              <p style="margin: 24px 0 0 0; padding: 16px; background-color: #fff4e6; border-left: 4px solid #ff9500; font-size: 14px; line-height: 20px; color: #8b5a00; border-radius: 4px;">
                ⏰ ${t.expiryNotice}
              </p>

              <!-- Security Notice -->
              <p style="margin: 24px 0 0 0; font-size: 14px; line-height: 20px; color: #6a6a6a;">
                🔒 ${t.securityNotice}
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
                ${email}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}

export function getPasswordResetEmailText({
  resetUrl,
  email,
  locale,
}: PasswordResetEmailProps): string {
  const t = content[locale] || content.en

  return `
${t.subject}

${t.greeting}

${t.bodyText}

${t.buttonText}: ${resetUrl}

${t.expiryNotice}

${t.securityNotice}
${t.ignoreText}

${t.supportText}
${email}
  `.trim()
}
