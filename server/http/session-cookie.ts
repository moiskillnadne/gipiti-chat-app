const SESSION_COOKIE_BASE_NAME = "authjs.session-token";
const SECURE_COOKIE_PREFIX = "__Secure-";

/**
 * The name Auth.js gives its session cookie. Over HTTPS (everything but local
 * development) it carries the `__Secure-` prefix.
 */
export const sessionCookieNameOf = (isSecure: boolean): string =>
  isSecure
    ? `${SECURE_COOKIE_PREFIX}${SESSION_COOKIE_BASE_NAME}`
    : SESSION_COOKIE_BASE_NAME;

/**
 * Which of a request's cookies hold the Auth.js session. A session too large
 * for one cookie is split into `<name>.0`, `<name>.1`, …, so deleting a
 * session means deleting every one of them.
 */
export const sessionCookieNamesAmong = (
  cookieNames: readonly string[],
  isSecure: boolean
): string[] => {
  const sessionCookieName = sessionCookieNameOf(isSecure);
  const chunkPrefix = `${sessionCookieName}.`;

  return cookieNames.filter(
    (cookieName) =>
      cookieName === sessionCookieName || cookieName.startsWith(chunkPrefix)
  );
};
