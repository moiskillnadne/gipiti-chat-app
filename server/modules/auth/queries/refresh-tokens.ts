import { count, eq } from "drizzle-orm";

import { ChatSDKError } from "@/lib/errors";
import { db } from "@/server/db/connection";
import { authSession, refreshToken, user } from "@/server/db/schema";
import {
  MAX_SIBLING_TOKENS,
  REFRESH_REUSE_GRACE_MS,
  refreshTokenExpiryOf,
  SESSION_REVOCATION_REASONS,
} from "@/server/modules/auth/session-policy";

export type RefreshTokenRotation =
  | {
      status: "rotated";
      userId: string;
      sessionId: string;
      /** The account's token version, for the new access token. */
      tokenVersion: number;
      refreshTokenExpiresAt: Date;
    }
  /** No such token was ever issued (or it was deleted long after it died). */
  | { status: "unknown_token" }
  /** The token, or its whole session, is past its end. */
  | { status: "expired" }
  | { status: "session_revoked" }
  /**
   * A used token came back after the grace time: someone holds a copy. The
   * session has been revoked.
   */
  | { status: "reused" }
  /** More retries with one token than a client can need. Nothing revoked. */
  | { status: "too_many_retries" };

/** The first rotation of a token makes one child; siblings are extra. */
const MAX_CHILDREN_OF_ONE_TOKEN = 1 + MAX_SIBLING_TOKENS;

/**
 * Replaces a refresh token by a new one, in one transaction that holds a row
 * lock on the token's session. The lock makes concurrent refreshes of one
 * session take turns, so each of them sees what the previous one did.
 *
 * - A token that was never used: it is marked used and gets a child.
 * - A used token, within the grace time: the caller is a second request of
 *   the same client and gets a child of its own, twice at most.
 * - A used token, after the grace time: it was copied. The session is
 *   revoked, for the thief and the owner alike; the owner signs in again.
 *
 * Only hashes are stored and compared; the new token's hash is passed in.
 */
export async function rotateRefreshToken({
  tokenHash,
  newTokenHash,
  now,
}: {
  tokenHash: string;
  newTokenHash: string;
  now: Date;
}): Promise<RefreshTokenRotation> {
  try {
    return await db.transaction(async (tx): Promise<RefreshTokenRotation> => {
      const [owner] = await tx
        .select({ sessionId: refreshToken.sessionId })
        .from(refreshToken)
        .where(eq(refreshToken.tokenHash, tokenHash));

      if (!owner) {
        return { status: "unknown_token" };
      }

      // The lock. Everything below is read after it is held, in statements
      // of their own, so it is the state the previous holder left behind.
      const [session] = await tx
        .select({
          id: authSession.id,
          userId: authSession.userId,
          absoluteExpiresAt: authSession.absoluteExpiresAt,
          revokedAt: authSession.revokedAt,
        })
        .from(authSession)
        .where(eq(authSession.id, owner.sessionId))
        .for("update");

      const [token] = await tx
        .select({
          id: refreshToken.id,
          expiresAt: refreshToken.expiresAt,
          usedAt: refreshToken.usedAt,
        })
        .from(refreshToken)
        .where(eq(refreshToken.tokenHash, tokenHash));

      if (!(session && token)) {
        return { status: "unknown_token" };
      }
      if (session.revokedAt) {
        return { status: "session_revoked" };
      }
      if (token.expiresAt <= now || session.absoluteExpiresAt <= now) {
        return { status: "expired" };
      }

      if (token.usedAt) {
        const isWithinGraceTime =
          now.getTime() - token.usedAt.getTime() <= REFRESH_REUSE_GRACE_MS;

        if (!isWithinGraceTime) {
          await tx
            .update(authSession)
            .set({
              revokedAt: now,
              revokedReason: SESSION_REVOCATION_REASONS.refreshReused,
            })
            .where(eq(authSession.id, session.id));

          return { status: "reused" };
        }

        const [children] = await tx
          .select({ total: count() })
          .from(refreshToken)
          .where(eq(refreshToken.parentId, token.id));

        if (children.total >= MAX_CHILDREN_OF_ONE_TOKEN) {
          return { status: "too_many_retries" };
        }
      } else {
        await tx
          .update(refreshToken)
          .set({ usedAt: now })
          .where(eq(refreshToken.id, token.id));
      }

      const refreshTokenExpiresAt = refreshTokenExpiryOf(
        now,
        session.absoluteExpiresAt
      );

      await tx.insert(refreshToken).values({
        sessionId: session.id,
        tokenHash: newTokenHash,
        parentId: token.id,
        createdAt: now,
        expiresAt: refreshTokenExpiresAt,
      });

      await tx
        .update(authSession)
        .set({ lastUsedAt: now })
        .where(eq(authSession.id, session.id));

      const [account] = await tx
        .select({ tokenVersion: user.tokenVersion })
        .from(user)
        .where(eq(user.id, session.userId));

      return {
        status: "rotated",
        userId: session.userId,
        sessionId: session.id,
        tokenVersion: account.tokenVersion,
        refreshTokenExpiresAt,
      };
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to rotate refresh token"
    );
  }
}
