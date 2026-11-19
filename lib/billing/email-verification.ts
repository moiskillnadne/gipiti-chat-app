import { eq } from "drizzle-orm";

import { db } from "@/server/db/connection";
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
 * Returns false for an unknown user.
 */
export async function isUserEmailVerified(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ emailVerified: user.emailVerified })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  return row?.emailVerified ?? false;
}

/**
 * Throw `EmailNotVerifiedError` unless the user's email is verified.
 */
export async function assertEmailVerified(userId: string): Promise<void> {
  const isVerified = await isUserEmailVerified(userId);
  if (!isVerified) {
    throw new EmailNotVerifiedError(userId);
  }
}
