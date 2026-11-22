import { grantEmailVerificationBonus } from "@/lib/billing/balance";
import { checkVerificationAttemptRateLimit } from "@/server/http/rate-limit";
import { markVerifiedAndGrantDeferredWelcome } from "@/server/modules/auth/queries/verify-api-signup-email";
import { verifyToken } from "@/server/modules/auth/reset-token";
import { getUserByEmail } from "@/server/modules/users/queries/get-by-email";
import { markEmailAsVerified } from "@/server/modules/users/queries/mark-email-as-verified";
import {
  MAX_EMAIL_VERIFICATION_ATTEMPTS,
  takeVerificationAttempt,
} from "@/server/modules/users/queries/take-verification-attempt";

export type VerifyEmailCodeResult =
  /**
   * `isBonusGranted`: the email-confirmation bonus was credited now (false
   * when it was paid before, or failed). `isWelcomeGrantCredited`: the
   * welcome grant an API sign-up had been waiting for was credited now.
   */
  | {
      status: "verified";
      isBonusGranted: boolean;
      isWelcomeGrantCredited: boolean;
    }
  /**
   * A wrong code; `attemptsLeft` more guesses before the code dies. It is 0
   * when there was no live code to guess against (none was ever sent, or no
   * account has the email): asking for a new code is the only way on.
   */
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
 *
 * The result says a lot about the account (`already_verified`, a dead code,
 * how many guesses are left). A caller must take the email from a signed-in
 * user, or, like the web form, pass on only what an anonymous visitor may
 * learn; handing the whole result to an anonymous caller reveals which
 * emails have an account.
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

  // An account created through the API is owed its welcome grant now. The
  // two are one transaction: if the grant fails, the email is not verified
  // either and this function throws; the user enters the code again, or
  // asks for a new one. An email left verified with its grant unpaid could
  // never be paid: a verified account has no code to enter.
  const isApiSignup =
    attempt.signupPlatform !== null && attempt.signupPlatform !== undefined;

  let isWelcomeGrantCredited = false;
  if (isApiSignup) {
    isWelcomeGrantCredited = await markVerifiedAndGrantDeferredWelcome({
      email,
      userId: attempt.userId,
    });
  } else {
    await markEmailAsVerified({ email });
  }

  return {
    status: "verified",
    isBonusGranted: await grantBonus(attempt.userId),
    isWelcomeGrantCredited,
  };
};
