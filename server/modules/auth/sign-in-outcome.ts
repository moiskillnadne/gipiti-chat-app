/** Where the Auth.js routes are served (`app/(auth)/api/auth/[...nextauth]`). */
const AUTH_ROUTES_PATH_PREFIX = "/api/auth/";

/**
 * Auth.js answers with absolute URLs; this base only lets a relative one be
 * parsed. Its host is never read.
 */
const RELATIVE_URL_BASE = "http://localhost";

/**
 * What `signIn(..., { redirect: false })` resolves with: the URL Auth.js would
 * have redirected to. The object shape is what the client-side `signIn`
 * answers; the server one never does, but `login` has always handled it.
 */
export type SignInOutcome =
  | string
  | { error?: string; ok?: boolean }
  | undefined;

/**
 * Whether a resolved `signIn` ended without a session.
 *
 * `signIn` throws for the failures Auth.js expects (a wrong password, an
 * error inside `authorize`), but it resolves for the rest:
 * - an error thrown outside the credentials callback is turned into a
 *   redirect to the error page, `/api/auth/error?error=Configuration`;
 * - a request Auth.js refuses before `authorize` runs (untrusted host, a
 *   broken `authjs.callback-url` cookie) gets an answer with no `Location`,
 *   and `signIn` falls back to the URL it posted to,
 *   `/api/auth/callback/credentials`.
 * A successful sign-in resolves with the page the form was posted from, or
 * `/`. So the signal is the path: a URL inside the Auth.js routes is never
 * where a signed-in user is sent. The `error` query parameter is not used
 * because it is missing in the second case and present after a successful
 * sign-in from `/login?error=...`. If `pages.error` is ever configured in
 * `next-auth.config.ts`, that path has to be recognised here as well.
 */
export const hasSignInEndedWithoutSession = (
  outcome: SignInOutcome
): boolean => {
  if (typeof outcome !== "string") {
    return Boolean(outcome?.error) || outcome?.ok === false;
  }

  // A string that is not a URL at all is not a known success.
  if (!URL.canParse(outcome, RELATIVE_URL_BASE)) {
    return true;
  }

  const { pathname } = new URL(outcome, RELATIVE_URL_BASE);

  return pathname.startsWith(AUTH_ROUTES_PATH_PREFIX);
};
