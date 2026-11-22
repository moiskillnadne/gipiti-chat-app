import { checkVerificationResendRateLimit } from "@/server/http/rate-limit";
import { sendVerificationEmail } from "@/server/modules/email/send-verification-email";
import { getUserByEmail } from "@/server/modules/users/queries/get-by-email";

export type SendVerificationCodeResult =
  | { status: "sent" }
  /** No account has this email. Nothing was sent. */
  | { status: "unknown_user" }
  /** The email is confirmed already. Nothing was sent. */
  | { status: "already_verified" }
  /** One code a minute; `resetAt` is when the next one may be asked for. */
  | { status: "rate_limited"; resetAt: number | undefined }
  /** The limit could not be checked, so the request is refused. */
  | { status: "limiter_unavailable" }
  | { status: "send_failed" };

/**
 * Generates a new verification code for the account with this email and
 * sends it there.
 *
 * A caller that takes the email from an anonymous visitor must not tell
 * `unknown_user` and `already_verified` apart from `sent` in its answer, or
 * it reveals which emails have an account.
 */
export const sendVerificationCode = async ({
  email,
}: {
  email: string;
}): Promise<SendVerificationCodeResult> => {
  const rateLimitResult = await checkVerificationResendRateLimit(email);
  if (rateLimitResult.isUnavailable) {
    return { status: "limiter_unavailable" };
  }
  if (!rateLimitResult.success) {
    return { status: "rate_limited", resetAt: rateLimitResult.reset };
  }

  const userRecord = await getUserByEmail(email);
  if (!userRecord) {
    return { status: "unknown_user" };
  }
  if (userRecord.emailVerified) {
    return { status: "already_verified" };
  }

  const emailResult = await sendVerificationEmail({ email });
  if (!emailResult.success) {
    console.error("Failed to resend verification email:", emailResult.error);
    return { status: "send_failed" };
  }

  return { status: "sent" };
};
