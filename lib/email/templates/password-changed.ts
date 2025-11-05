type PasswordChangedEmailProps = {
  email: string
  locale: string
  timestamp: Date
  resetUrl: string
}

type LocaleContent = {
  subject: string
  greeting: string
  confirmationText: string
  timestampLabel: string
  securityWarning: string
  actionText: string
  buttonText: string
  supportText: string
}

const content: Record<string, LocaleContent> = {
  en: {
    subject: "Your password was changed",
    greeting: "Hello,",
    confirmationText:
      "This email confirms that your password was successfully changed.",
    timestampLabel: "Changed on:",
    securityWarning:
      "If you did not make this change, your account may have been compromised. Please reset your password immediately and contact our support team.",
    actionText: "Reset your password again",
    buttonText: "Reset Password Now",
    supportText: "Questions? Contact our support team.",
  },
  ru: {
    subject: "Ваш пароль был изменен",
    greeting: "Здравствуйте,",
    confirmationText: "Это письмо подтверждает, что ваш пароль был успешно изменен.",
    timestampLabel: "Изменено:",
    securityWarning:
      "Если вы не вносили это изменение, ваша учетная запись может быть скомпрометирована. Пожалуйста, немедленно сбросьте пароль и свяжитесь с нашей службой поддержки.",
    actionText: "Сбросить пароль еще раз",
    buttonText: "Сбросить пароль сейчас",
    supportText: "Есть вопросы? Свяжитесь с нашей службой поддержки.",
  },
}

export function getPasswordChangedEmailSubject(locale: string): string {
  return content[locale]?.subject || content.en.subject
}

export function getPasswordChangedEmailHtml({
  email,
  locale,
  timestamp,
  resetUrl,
}: PasswordChangedEmailProps): string {
  const t = content[locale] || content.en

  const formattedTimestamp = timestamp.toLocaleString(locale === "ru" ? "ru-RU" : "en-US", {
    dateStyle: "long",
    timeStyle: "short",
  })

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
              <div style="width: 64px; height: 64px; margin: 0 auto 16px auto; background-color: #10b981; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 32px;">✓</span>
              </div>
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
                ${t.confirmationText}
              </p>

              <!-- Timestamp -->
              <div style="margin: 24px 0; padding: 16px; background-color: #f0fdf4; border-left: 4px solid #10b981; border-radius: 4px;">
                <p style="margin: 0; font-size: 14px; line-height: 20px; color: #166534;">
                  <strong>${t.timestampLabel}</strong> ${formattedTimestamp}
                </p>
              </div>

              <!-- Security Warning -->
              <div style="margin: 32px 0; padding: 20px; background-color: #fef2f2; border-left: 4px solid #ef4444; border-radius: 4px;">
                <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 20px; color: #991b1b; font-weight: 500;">
                  🔐 ${t.securityWarning}
                </p>
                <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 20px; color: #991b1b;">
                  ${t.actionText}:
                </p>
                <table role="presentation" style="margin: 0; width: 100%;">
                  <tr>
                    <td align="left">
                      <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #ef4444; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 500;">
                        ${t.buttonText}
                      </a>
                    </td>
                  </tr>
                </table>
              </div>
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

export function getPasswordChangedEmailText({
  email,
  locale,
  timestamp,
  resetUrl,
}: PasswordChangedEmailProps): string {
  const t = content[locale] || content.en

  const formattedTimestamp = timestamp.toLocaleString(locale === "ru" ? "ru-RU" : "en-US", {
    dateStyle: "long",
    timeStyle: "short",
  })

  return `
${t.subject}

${t.greeting}

${t.confirmationText}

${t.timestampLabel} ${formattedTimestamp}

${t.securityWarning}

${t.actionText}: ${resetUrl}

${t.supportText}
${email}
  `.trim()
}
