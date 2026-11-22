import { and, eq, isNull, sql } from "drizzle-orm";
import { ChatSDKError } from "@/lib/errors";
import { db } from "@/server/db/connection";
import { authSession, type User, user } from "@/server/db/schema";

/** `AuthSession.revoked_reason` of a session ended by a new password. */
export const PASSWORD_CHANGED_REVOCATION_REASON = "password_changed";

/**
 * Sets a new password and ends every session of the account, in one
 * transaction:
 *
 * - the password is stored and a pending reset token is spent;
 * - `token_version` goes up by one, which ends the web cookies and the API
 *   access tokens issued so far;
 * - the account's API sessions are revoked, so their refresh tokens stop
 *   working too.
 *
 * A new password that left old sessions alive would not lock out whoever
 * made the owner change it.
 *
 * The caller passes the returned `tokenVersion` on to `rememberTokenVersion`,
 * so that the cache learns the new number at once.
 *
 * @returns the updated row; empty when no account has this id
 */
export async function updateUserPassword({
  userId,
  hashedPassword,
}: {
  userId: string;
  hashedPassword: string;
}): Promise<User[]> {
  try {
    return await db.transaction(async (tx) => {
      const now = new Date();

      const updatedUsers = await tx
        .update(user)
        .set({
          password: hashedPassword,
          resetPasswordToken: null,
          resetPasswordTokenExpiry: null,
          tokenVersion: sql`${user.tokenVersion} + 1`,
          updatedAt: now,
        })
        .where(eq(user.id, userId))
        .returning();

      await tx
        .update(authSession)
        .set({
          revokedAt: now,
          revokedReason: PASSWORD_CHANGED_REVOCATION_REASON,
        })
        .where(
          and(eq(authSession.userId, userId), isNull(authSession.revokedAt))
        );

      return updatedUsers;
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update user password"
    );
  }
}
