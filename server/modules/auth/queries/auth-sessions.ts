import { and, eq, gt, isNull, lt, sql } from "drizzle-orm";

import { ChatSDKError } from "@/lib/errors";
import { db } from "@/server/db/connection";
import {
  type AuthSession,
  authSession,
  refreshToken,
  user,
} from "@/server/db/schema";
import {
  DEAD_SESSION_RETENTION_MS,
  refreshTokenExpiryOf,
  SESSION_ABSOLUTE_TTL_MS,
  type SessionRevocationReason,
} from "@/server/modules/auth/session-policy";

const databaseError = (message: string): ChatSDKError =>
  new ChatSDKError("bad_request:database", message);

export type NewAuthSessionInput = {
  userId: string;
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
 * @returns null when the account does not exist
 */
export async function createAuthSession({
  userId,
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
        .where(eq(user.id, userId));

      if (!account) {
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
 * Housekeeping: deletes sessions a week past their absolute end (their
 * refresh tokens go with them) and refresh tokens a week past their expiry.
 *
 * A used refresh token is kept until it expires, not deleted when it is
 * replaced: presenting it again is how a copied token is noticed.
 */
export async function deleteDeadAuthRecords(
  now: Date
): Promise<DeletedAuthRecords> {
  const cutoff = new Date(now.getTime() - DEAD_SESSION_RETENTION_MS);

  try {
    const deletedSessions = await db
      .delete(authSession)
      .where(lt(authSession.absoluteExpiresAt, cutoff))
      .returning({ id: authSession.id });

    const deletedTokens = await db
      .delete(refreshToken)
      .where(lt(refreshToken.expiresAt, cutoff))
      .returning({ id: refreshToken.id });

    return {
      sessions: deletedSessions.length,
      refreshTokens: deletedTokens.length,
    };
  } catch (_error) {
    throw databaseError("Failed to delete dead auth records");
  }
}
