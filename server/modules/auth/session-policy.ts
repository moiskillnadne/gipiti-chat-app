const MILLISECONDS_PER_SECOND = 1000;
const MILLISECONDS_PER_MINUTE = 60 * MILLISECONDS_PER_SECOND;
const MILLISECONDS_PER_DAY = 24 * 60 * MILLISECONDS_PER_MINUTE;

/** A refresh token is good for 60 days; each refresh starts the 60 anew. */
export const REFRESH_TOKEN_TTL_MS = 60 * MILLISECONDS_PER_DAY;

/**
 * A session ends 180 days after sign-in however often it was refreshed.
 * Then the user signs in again.
 */
export const SESSION_ABSOLUTE_TTL_MS = 180 * MILLISECONDS_PER_DAY;

/**
 * For this long after a refresh token was used, presenting it again is taken
 * for a second request of the same client (two requests found the access
 * token expired at once, or the answer to the first one was lost), and gets
 * a pair of its own. After it, the same act means the token was copied.
 */
export const REFRESH_REUSE_GRACE_MS = 30 * MILLISECONDS_PER_SECOND;

/** How many such extra pairs one refresh token can produce in the grace time. */
export const MAX_SIBLING_TOKENS = 2;

/** `AuthSession.last_used_at` is written at most this often. */
export const SESSION_TOUCH_INTERVAL_MS = 5 * MILLISECONDS_PER_MINUTE;

/** Dead sessions and refresh tokens are deleted this long after they died. */
export const DEAD_SESSION_RETENTION_MS = 7 * MILLISECONDS_PER_DAY;

/** The values of `AuthSession.revoked_reason`. */
export const SESSION_REVOCATION_REASONS = {
  logout: "logout",
  logoutAll: "logout_all",
  revokedByUser: "revoked_by_user",
  refreshReused: "refresh_reused",
} as const;

export type SessionRevocationReason =
  (typeof SESSION_REVOCATION_REASONS)[keyof typeof SESSION_REVOCATION_REASONS];

/**
 * When a refresh token issued at `now` stops being accepted: 60 days on, but
 * never past the end of its session.
 */
export const refreshTokenExpiryOf = (
  now: Date,
  sessionAbsoluteExpiresAt: Date
): Date =>
  new Date(
    Math.min(
      now.getTime() + REFRESH_TOKEN_TTL_MS,
      sessionAbsoluteExpiresAt.getTime()
    )
  );
