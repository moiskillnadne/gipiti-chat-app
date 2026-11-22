import { and, desc, eq, gt, inArray, isNull, lt, or, sql } from "drizzle-orm";

import { ChatSDKError } from "@/lib/errors";
import { type DatabaseExecutor, db } from "@/server/db/connection";
import {
  type AuthSession,
  authSession,
  refreshToken,
  user,
} from "@/server/db/schema";
import {
  DEAD_SESSION_RETENTION_MS,
  MAX_LIVE_SESSIONS_PER_ACCOUNT,
  refreshTokenExpiryOf,
  SESSION_ABSOLUTE_TTL_MS,
  type SessionRevocationReason,
} from "@/server/modules/auth/session-policy";

const databaseError = (message: string): ChatSDKError =>
  new ChatSDKError("bad_request:database", message);

export type NewAuthSessionInput = {
  userId: string;
  /**
   * The account's token version as it was read together with the
   * credentials that were checked. The session is not opened when the
   * account has a different one by now.
   */
  expectedTokenVersion: number;
  clientKind: string;
  platform: string | null;
  deviceName: string | null;
  appVersion: string | null;
  createdIp: string | null;
  /** SHA-256 of the session's first refresh token. */
  refreshTokenHash: string;
  now: Date;
};

export type CreatedAuthSession = {
  sessionId: string;
  /** The account's token version, for the access token of the new session. */
  tokenVersion: number;
  refreshTokenExpiresAt: Date;
};

/**
 * Opens a session with its first refresh token, in one transaction.
 *
 * The transaction first locks the account's row. That makes it take turns
 * with a password reset and with "log out everywhere", which update that
 * row: either this session is committed before they run, and they revoke it,
 * or they finish first, the version has moved on, and no session is opened.
 * Without the lock a sign-in that was checking the old password while the
 * password was being reset would come out with a session that outlives the
 * reset. It also makes the sign-ins of one account take turns, so the cap
 * below holds.
 *
 * The lock is `FOR NO KEY UPDATE`: it excludes those updates but not the
 * foreign-key checks of rows being inserted for the same account elsewhere.
 *
 * @returns null when the account does not exist or its token version is no
 * longer `expectedTokenVersion`
 */
export async function createAuthSession({
  userId,
  expectedTokenVersion,
  clientKind,
  platform,
  deviceName,
  appVersion,
  createdIp,
  refreshTokenHash,
  now,
}: NewAuthSessionInput): Promise<CreatedAuthSession | null> {
  try {
    return await db.transaction(async (tx) => {
      const [account] = await tx
        .select({ tokenVersion: user.tokenVersion })
        .from(user)
        .where(eq(user.id, userId))
        .for("no key update");

      if (!account || account.tokenVersion !== expectedTokenVersion) {
        return null;
      }

      const absoluteExpiresAt = new Date(
        now.getTime() + SESSION_ABSOLUTE_TTL_MS
      );
      const refreshTokenExpiresAt = refreshTokenExpiryOf(
        now,
        absoluteExpiresAt
      );

      const [session] = await tx
        .insert(authSession)
        .values({
          userId,
          clientKind,
          platform,
          deviceName,
          appVersion,
          createdIp,
          createdAt: now,
          lastUsedAt: now,
          absoluteExpiresAt,
        })
        .returning({ id: authSession.id });

      await tx.insert(refreshToken).values({
        sessionId: session.id,
        tokenHash: refreshTokenHash,
        createdAt: now,
        expiresAt: refreshTokenExpiresAt,
      });

      await deleteSessionsBeyondTheCap(tx, userId, now);

      return {
        sessionId: session.id,
        tokenVersion: account.tokenVersion,
        refreshTokenExpiresAt,
      };
    });
  } catch (_error) {
    throw databaseError("Failed to create auth session");
  }
}

/**
 * Keeps an account at `MAX_LIVE_SESSIONS_PER_ACCOUNT` live sessions by
 * deleting the ones that have gone unused the longest. Deleted, not revoked:
 * a revoked row would stay for months, and the point is that signing in over
 * and over cannot grow the tables. Called under the lock on the account's
 * row, so two sign-ins cannot both think there is room.
 */
const deleteSessionsBeyondTheCap = async (
  tx: DatabaseExecutor,
  userId: string,
  now: Date
): Promise<void> => {
  const surplus = await tx
    .select({ id: authSession.id })
    .from(authSession)
    .where(
      and(
        eq(authSession.userId, userId),
        isNull(authSession.revokedAt),
        gt(authSession.absoluteExpiresAt, now)
      )
    )
    .orderBy(desc(authSession.lastUsedAt), desc(authSession.createdAt))
    .offset(MAX_LIVE_SESSIONS_PER_ACCOUNT);

  if (surplus.length === 0) {
    return;
  }

  await tx.delete(authSession).where(
    inArray(
      authSession.id,
      surplus.map((session) => session.id)
    )
  );
};

export type AuthSessionState = Pick<
  AuthSession,
  "id" | "userId" | "lastUsedAt" | "absoluteExpiresAt" | "revokedAt"
> & {
  /** The current token version of the session's account. */
  tokenVersion: number;
};

/** A session and its account's token version, in one query. */
export async function getAuthSessionState(
  sessionId: string
): Promise<AuthSessionState | null> {
  try {
    const [row] = await db
      .select({
        id: authSession.id,
        userId: authSession.userId,
        lastUsedAt: authSession.lastUsedAt,
        absoluteExpiresAt: authSession.absoluteExpiresAt,
        revokedAt: authSession.revokedAt,
        tokenVersion: user.tokenVersion,
      })
      .from(authSession)
      .innerJoin(user, eq(user.id, authSession.userId))
      .where(eq(authSession.id, sessionId));

    return row ?? null;
  } catch (_error) {
    throw databaseError("Failed to get auth session");
  }
}

/** Records that the session was used at `now`. */
export async function touchAuthSession(
  sessionId: string,
  now: Date
): Promise<void> {
  try {
    await db
      .update(authSession)
      .set({ lastUsedAt: now })
      .where(eq(authSession.id, sessionId));
  } catch (_error) {
    throw databaseError("Failed to touch auth session");
  }
}

/**
 * Ends one session of an account.
 *
 * @returns false when the account has no live session with this id
 */
export async function revokeAuthSession({
  sessionId,
  userId,
  reason,
  now,
}: {
  sessionId: string;
  userId: string;
  reason: SessionRevocationReason;
  now: Date;
}): Promise<boolean> {
  try {
    const revoked = await db
      .update(authSession)
      .set({ revokedAt: now, revokedReason: reason })
      .where(
        and(
          eq(authSession.id, sessionId),
          eq(authSession.userId, userId),
          isNull(authSession.revokedAt)
        )
      )
      .returning({ id: authSession.id });

    return revoked.length > 0;
  } catch (_error) {
    throw databaseError("Failed to revoke auth session");
  }
}

/**
 * Ends every session of an account: revokes its API sessions and raises its
 * token version, which also ends its web cookies. One transaction.
 *
 * @returns the new token version, or null when the account does not exist
 */
export async function revokeAllAuthSessions({
  userId,
  reason,
  now,
}: {
  userId: string;
  reason: SessionRevocationReason;
  now: Date;
}): Promise<number | null> {
  try {
    return await db.transaction(async (tx) => {
      const [account] = await tx
        .update(user)
        .set({ tokenVersion: sql`${user.tokenVersion} + 1` })
        .where(eq(user.id, userId))
        .returning({ tokenVersion: user.tokenVersion });

      if (!account) {
        return null;
      }

      await tx
        .update(authSession)
        .set({ revokedAt: now, revokedReason: reason })
        .where(
          and(eq(authSession.userId, userId), isNull(authSession.revokedAt))
        );

      return account.tokenVersion;
    });
  } catch (_error) {
    throw databaseError("Failed to revoke auth sessions");
  }
}

export type LiveAuthSession = Pick<
  AuthSession,
  "id" | "platform" | "deviceName" | "appVersion" | "createdAt" | "lastUsedAt"
>;

/** The account's sessions that can still be used, most recently used first. */
export async function listLiveAuthSessions(
  userId: string,
  now: Date
): Promise<LiveAuthSession[]> {
  try {
    return await db
      .select({
        id: authSession.id,
        platform: authSession.platform,
        deviceName: authSession.deviceName,
        appVersion: authSession.appVersion,
        createdAt: authSession.createdAt,
        lastUsedAt: authSession.lastUsedAt,
      })
      .from(authSession)
      .where(
        and(
          eq(authSession.userId, userId),
          isNull(authSession.revokedAt),
          gt(authSession.absoluteExpiresAt, now)
        )
      )
      .orderBy(sql`${authSession.lastUsedAt} DESC`);
  } catch (_error) {
    throw databaseError("Failed to list auth sessions");
  }
}

export type DeletedAuthRecords = {
  sessions: number;
  refreshTokens: number;
};

/**
 * Housekeeping. Deletes, a week after they died:
 *
 * - sessions past their absolute end, and sessions that were revoked (their
 *   refresh tokens go with them);
 * - refresh tokens that expired without ever being used.
 *
 * A **used** refresh token is not deleted here. It stays for as long as its
 * session does: presenting it again is how a copied token is noticed, and
 * the copy may be presented months after the token was replaced.
 */
export async function deleteDeadAuthRecords(
  now: Date
): Promise<DeletedAuthRecords> {
  const cutoff = new Date(now.getTime() - DEAD_SESSION_RETENTION_MS);

  try {
    const deletedSessions = await db
      .delete(authSession)
      .where(
        or(
          lt(authSession.absoluteExpiresAt, cutoff),
          lt(authSession.revokedAt, cutoff)
        )
      );

    const deletedTokens = await db
      .delete(refreshToken)
      .where(
        and(isNull(refreshToken.usedAt), lt(refreshToken.expiresAt, cutoff))
      );

    // The count of affected rows; no row is read back.
    return {
      sessions: deletedSessions.count,
      refreshTokens: deletedTokens.count,
    };
  } catch (_error) {
    throw databaseError("Failed to delete dead auth records");
  }
}
