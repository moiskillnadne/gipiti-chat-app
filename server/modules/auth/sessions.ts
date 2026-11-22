import { randomBytes } from "node:crypto";

import {
  signAccessToken,
  verifyAccessToken,
} from "@/server/modules/auth/access-token";
import {
  createAuthSession,
  getAuthSessionState,
  type LiveAuthSession,
  listLiveAuthSessions,
  revokeAllAuthSessions,
  revokeAuthSession,
  touchAuthSession,
} from "@/server/modules/auth/queries/auth-sessions";
import { rotateRefreshToken } from "@/server/modules/auth/queries/refresh-tokens";
import { hashToken } from "@/server/modules/auth/reset-token";
import {
  SESSION_REVOCATION_REASONS,
  SESSION_TOUCH_INTERVAL_MS,
} from "@/server/modules/auth/session-policy";
import { rememberTokenVersion } from "@/server/modules/auth/token-version";

const REFRESH_TOKEN_BYTES = 32;

/** The only kind of client that holds an API session so far. */
const MOBILE_CLIENT_KIND = "mobile";

/** What a client tells about itself when it signs in. */
export type SessionClient = {
  platform: string;
  deviceName?: string;
  appVersion?: string;
};

/** A new access token with the refresh token that renews it. */
export type TokenPair = {
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
};

/** Who a valid access token stands for. */
export type BearerSession = {
  userId: string;
  sessionId: string;
};

/**
 * A new refresh token: 32 random bytes. The client gets the token; the
 * database gets only its SHA-256, so a leaked table gives nobody a session.
 */
const createRefreshToken = (): { token: string; tokenHash: string } => {
  const token = randomBytes(REFRESH_TOKEN_BYTES).toString("base64url");

  return { token, tokenHash: hashToken(token) };
};

/**
 * Opens an API session for an account whose credentials were just checked.
 *
 * @returns null when the account vanished in between
 * @throws ApiTokenSecretError in production when the token secret is missing
 */
export const issueTokenPair = async ({
  userId,
  client,
  ip,
  now = new Date(),
}: {
  userId: string;
  client: SessionClient;
  ip: string | null;
  now?: Date;
}): Promise<TokenPair | null> => {
  const refresh = createRefreshToken();

  const session = await createAuthSession({
    userId,
    clientKind: MOBILE_CLIENT_KIND,
    platform: client.platform,
    deviceName: client.deviceName ?? null,
    appVersion: client.appVersion ?? null,
    createdIp: ip,
    refreshTokenHash: refresh.tokenHash,
    now,
  });

  if (!session) {
    return null;
  }

  const access = await signAccessToken(
    {
      userId,
      sessionId: session.sessionId,
      tokenVersion: session.tokenVersion,
    },
    now
  );

  return {
    accessToken: access.token,
    accessTokenExpiresAt: access.expiresAt,
    refreshToken: refresh.token,
    refreshTokenExpiresAt: session.refreshTokenExpiresAt,
  };
};

export type RefreshTokenPairResult =
  | { status: "refreshed"; tokens: TokenPair }
  /** Not a refresh token of ours, or retried more often than a client needs. */
  | { status: "refresh_invalid" }
  | { status: "refresh_expired" }
  | { status: "session_revoked" }
  /** The token was used before and is too old to be a retry: session revoked. */
  | { status: "refresh_reused" };

/**
 * Trades a refresh token for a new pair. The old token stops working; see
 * `rotateRefreshToken` for what happens when it is presented again.
 *
 * @throws ApiTokenSecretError in production when the token secret is missing
 */
export const refreshTokenPair = async ({
  refreshToken,
  now = new Date(),
}: {
  refreshToken: string;
  now?: Date;
}): Promise<RefreshTokenPairResult> => {
  const next = createRefreshToken();

  const rotation = await rotateRefreshToken({
    tokenHash: hashToken(refreshToken),
    newTokenHash: next.tokenHash,
    now,
  });

  switch (rotation.status) {
    case "rotated": {
      const access = await signAccessToken(
        {
          userId: rotation.userId,
          sessionId: rotation.sessionId,
          tokenVersion: rotation.tokenVersion,
        },
        now
      );

      return {
        status: "refreshed",
        tokens: {
          accessToken: access.token,
          accessTokenExpiresAt: access.expiresAt,
          refreshToken: next.token,
          refreshTokenExpiresAt: rotation.refreshTokenExpiresAt,
        },
      };
    }
    case "expired":
      return { status: "refresh_expired" };
    case "session_revoked":
      return { status: "session_revoked" };
    case "reused":
      return { status: "refresh_reused" };
    case "unknown_token":
    case "too_many_retries":
      return { status: "refresh_invalid" };
    default: {
      const unhandled: never = rotation;
      throw new Error(`Unhandled rotation: ${JSON.stringify(unhandled)}`);
    }
  }
};

/**
 * Who an access token stands for, or null when it must not be accepted.
 *
 * A valid signature is not enough: the session is looked up on every request
 * and refused when it was revoked, is past its absolute end, or the account's
 * token version moved on since the token was issued. So a logout, a password
 * reset and "log out everywhere" take effect at once, not when the token's
 * 15 minutes run out.
 *
 * @throws ApiTokenSecretError in production when the token secret is missing
 */
export const resolveBearerSession = async (
  accessToken: string,
  now: Date = new Date()
): Promise<BearerSession | null> => {
  const claims = await verifyAccessToken(accessToken);
  if (!claims) {
    return null;
  }

  const session = await getAuthSessionState(claims.sessionId);

  const isAlive =
    session !== null &&
    session.userId === claims.userId &&
    session.revokedAt === null &&
    session.absoluteExpiresAt > now &&
    session.tokenVersion === claims.tokenVersion;

  if (!isAlive) {
    return null;
  }

  // Bookkeeping for the list of devices; not worth a write on every request.
  const isTouchDue =
    now.getTime() - session.lastUsedAt.getTime() >= SESSION_TOUCH_INTERVAL_MS;
  if (isTouchDue) {
    try {
      await touchAuthSession(session.id, now);
    } catch (error) {
      console.warn("[auth-sessions] could not record session use:", error);
    }
  }

  return { userId: session.userId, sessionId: session.id };
};

/** Ends the caller's own session. True when it was alive until now. */
export const endSession = ({
  userId,
  sessionId,
  now = new Date(),
}: BearerSession & { now?: Date }): Promise<boolean> =>
  revokeAuthSession({
    userId,
    sessionId,
    reason: SESSION_REVOCATION_REASONS.logout,
    now,
  });

/**
 * Ends another session of the account, picked from the list of devices.
 * False when the account has no live session with this id.
 */
export const endSessionById = ({
  userId,
  sessionId,
  now = new Date(),
}: BearerSession & { now?: Date }): Promise<boolean> =>
  revokeAuthSession({
    userId,
    sessionId,
    reason: SESSION_REVOCATION_REASONS.revokedByUser,
    now,
  });

/**
 * "Log out everywhere": revokes every API session of the account and raises
 * its token version, which ends its web cookies too, the caller's included.
 */
export const endAllSessions = async (
  userId: string,
  now: Date = new Date()
): Promise<void> => {
  const tokenVersion = await revokeAllAuthSessions({
    userId,
    reason: SESSION_REVOCATION_REASONS.logoutAll,
    now,
  });

  if (tokenVersion !== null) {
    await rememberTokenVersion(userId, tokenVersion);
  }
};

/** The account's sessions that can still be used, most recently used first. */
export const listSessions = (
  userId: string,
  now: Date = new Date()
): Promise<LiveAuthSession[]> => listLiveAuthSessions(userId, now);
