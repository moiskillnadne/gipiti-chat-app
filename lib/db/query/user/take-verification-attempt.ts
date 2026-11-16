import { and, eq, gt, isNotNull, lt, sql } from "drizzle-orm";

import { normalizeEmail } from "@/lib/auth/normalize-email";
import { db } from "@/lib/db/connection";
import { user } from "@/lib/db/schema";
import { ChatSDKError } from "@/lib/errors";

/** How many times one verification code may be checked before it is dead. */
export const MAX_EMAIL_VERIFICATION_ATTEMPTS = 5;

export type VerificationAttempt = {
  userId: string;
  /** SHA-256 hex of the code that was emailed, to compare the guess against. */
  hashedCode: string;
  /** Attempts used on this code, this one included. */
  attemptsUsed: number;
};

/**
 * Spend one attempt on the live verification code of the account with this
 * email, and return the stored hash to compare the guess against.
 *
 * The check ("is there a live code with attempts left?") and the increment are
 * one UPDATE, so parallel guesses cannot use more attempts than the cap: each
 * statement waits for the row and re-checks the counter. The attempt is taken
 * before the comparison on purpose. Comparing first and counting only misses
 * would let any number of parallel guesses through before the first miss is
 * recorded.
 *
 * @returns null when there is nothing to check a guess against: no account
 * with this email, it is already verified, it has no code, the code expired,
 * or its attempts are used up.
 */
export async function takeVerificationAttempt({
  email,
}: {
  email: string;
}): Promise<VerificationAttempt | null> {
  try {
    const [attempt] = await db
      .update(user)
      .set({
        emailVerificationAttempts: sql`${user.emailVerificationAttempts} + 1`,
      })
      .where(
        and(
          sql`lower(${user.email}) = ${normalizeEmail(email)}`,
          eq(user.emailVerified, false),
          isNotNull(user.emailVerificationCode),
          gt(user.emailVerificationCodeExpiry, new Date()),
          lt(user.emailVerificationAttempts, MAX_EMAIL_VERIFICATION_ATTEMPTS)
        )
      )
      .returning({
        userId: user.id,
        hashedCode: user.emailVerificationCode,
        attemptsUsed: user.emailVerificationAttempts,
      });

    if (!attempt?.hashedCode) {
      return null;
    }

    return {
      userId: attempt.userId,
      hashedCode: attempt.hashedCode,
      attemptsUsed: attempt.attemptsUsed,
    };
  } catch (error) {
    console.error("[TakeVerificationAttempt] Query failed:", error);
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to take an email verification attempt"
    );
  }
}
