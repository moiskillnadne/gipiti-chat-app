const MIN_PASSWORD_LENGTH = 8;
const UPPERCASE_PATTERN = /[A-Z]/;
const LOWERCASE_PATTERN = /[a-z]/;
const DIGIT_PATTERN = /[0-9]/;
const SPECIAL_CHARACTER_PATTERN = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/;

/**
 * The rule for a new password (sign-up, reset, change): at least 8
 * characters with an uppercase letter, a lowercase letter, a digit and a
 * special character. Signing in does not apply it, so accounts with older,
 * weaker passwords keep working.
 *
 * The password field of the forms shows the same five requirements from
 * `lib/validation/password.ts`; this function is what the server enforces.
 */
export const isAcceptablePassword = (password: string): boolean =>
  password.length >= MIN_PASSWORD_LENGTH &&
  UPPERCASE_PATTERN.test(password) &&
  LOWERCASE_PATTERN.test(password) &&
  DIGIT_PATTERN.test(password) &&
  SPECIAL_CHARACTER_PATTERN.test(password);
