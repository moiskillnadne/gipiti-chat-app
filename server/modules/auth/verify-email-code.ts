import { grantEmailVerificationBonus } from "@/lib/billing/balance";
import { checkVerificationAttemptRateLimit } from "@/server/http/rate-limit";
import { verifyToken } from "@/server/modules/auth/reset-token";
import { getUserByEmail } from "@/server/modules/users/queries/get-by-email";
import { markEmailAsVerified } from "@/server/modules/users/queries/mark-email-as-verified";
import {
  MAX_EMAIL_VERIFICATION_ATTEMPTS,
  takeVerificationAttempt,
} from "@/server/modules/users/queries/take-verification-attempt";

export type VerifyEmailCodeResult =
  /** `isBonusGranted` is false when the bonus was paid before, or failed. */
  | { status: "verified"; isBonusGranted: boolean }
  /** A wrong code; `attemptsLeft` more guesses before the code dies. */
  | { status: "invalid_code"; attemptsLeft: number }
  /** The code is dead: too old, or its attempts are used up. Ask for a new one. */
  | { status: "expired_code" }
  | { status: "already_verified" }
  /** Too many checks for this email, or the limit could not be checked. */
  | { status: "rate_limited" };

/**
 * Why a code could not be checked for this email: the account is already
 * verified, its code is dead (expired, or its attempts are used up), or there
 * is nothing to check against.
 */
const resultWithoutLiveCode = async (
  email: string
): Promise<VerifyEmailCodeResult> => {
  const userRecord = await getUserByEmail(email);

  if (userRecord?.emailVerified) {
    return { status: "already_verified" };
  }

  return userRecord?.emailVerificationCode
    ? { status: "expired_code" }
    : { status: "invalid_code", attemptsLeft: 0 };
};

/**
 * Credits the one-time email-confirmation bonus. Best-effort and idempotent:
 * verification has already succeeded, so a bonus failure must not undo it.
 */
const grantBonus = async (userId: string): Promise<boolean> => {
  try {
    const bonus = await grantEmailVerificationBonus(userId);

    return bonus !== null;
  } catch (bonusError) {
    console.error("Failed to grant email verification bonus:", bonusError);
    return false;
  }
};

/**
 * Checks a 6-digit verification code against the account with this email
 * and, when it matches, marks the email verified and pays the bonus.
 */
export const verifyEmailCode = async ({
  email,
  code,
}: {
  email: string;
  code: string;
}): Promise<VerifyEmailCodeResult> => {
  const rateLimitResult = await checkVerificationAttemptRateLimit(email);
  if (!rateLimitResult.success) {
    return { status: "rate_limited" };
  }

  // Takes one of the code's attempts whether the guess is right or wrong;
  // see `takeVerificationAttempt` for why it is taken first.
  const attempt = await takeVerificationAttempt({ email });

  if (!attempt) {
    return await resultWithoutLiveCode(email);
  }

  if (!verifyToken(code, attempt.hashedCode)) {
    const attemptsLeft = MAX_EMAIL_VERIFICATION_ATTEMPTS - attempt.attemptsUsed;

    return attemptsLeft > 0
      ? { status: "invalid_code", attemptsLeft }
      : { status: "expired_code" };
  }

  await markEmailAsVerified({ email });

  return {
    status: "verified",
    isBonusGranted: await grantBonus(attempt.userId),
  };
};
