import { eq } from "drizzle-orm";

import { type DatabaseExecutor, db } from "@/server/db/connection";
import { user } from "@/server/db/schema";

/**
 * Thrown when a grant that requires a confirmed email is requested for a user
 * whose email is not verified. Callers map it to a user-facing refusal.
 */
export class EmailNotVerifiedError extends Error {
  readonly userId: string;

  constructor(userId: string) {
    super(`Email is not verified for user ${userId}`);
    this.name = "EmailNotVerifiedError";
    this.userId = userId;
  }
}

/**
 * Read the user's email-verification flag from the database. The session/JWT
 * value is a login-time snapshot, so billing decisions never rely on it.
 * Returns false for an unknown user. Inside a transaction, pass it as
 * `executor`.
 */
export async function isUserEmailVerified(
  userId: string,
  executor: DatabaseExecutor = db
): Promise<boolean> {
  const [row] = await executor
    .select({ emailVerified: user.emailVerified })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  return row?.emailVerified ?? false;
}

/**
 * Throw `EmailNotVerifiedError` unless the user's email is verified. Inside a
 * transaction, pass it as `executor`.
 */
export async function assertEmailVerified(
  userId: string,
  executor: DatabaseExecutor = db
): Promise<void> {
  const isVerified = await isUserEmailVerified(userId, executor);
  if (!isVerified) {
    throw new EmailNotVerifiedError(userId);
  }
}
