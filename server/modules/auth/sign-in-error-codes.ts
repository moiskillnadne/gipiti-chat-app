/**
 * `code` of the sign-in error thrown when a login attempt is refused by the
 * rate limiter. Auth.js puts the code of a credentials error into the error
 * it rethrows to the `login` action and into the redirect URL of the
 * `/api/auth/callback/credentials` endpoint.
 */
export const RATE_LIMITED_SIGN_IN_CODE = "rate_limited";

/**
 * True for the error `signIn` throws when `authorize` refused the attempt
 * because of the rate limiter. Checked by shape so callers do not have to
 * import the Auth.js error classes.
 */
export const isRateLimitedSignInError = (error: unknown): boolean =>
  error instanceof Error &&
  "code" in error &&
  error.code === RATE_LIMITED_SIGN_IN_CODE;
