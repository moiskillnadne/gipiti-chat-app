import { checkPasswordResetRateLimit } from "@/server/http/rate-limit";
import { createPasswordResetToken } from "@/server/modules/auth/reset-token";
import { sendPasswordResetEmail } from "@/server/modules/email/send-password-reset";
import { getUserByEmail } from "@/server/modules/users/queries/get-by-email";
import { setPasswordResetToken } from "@/server/modules/users/queries/set-password-reset-token";

export type RequestPasswordResetResult =
  | { status: "sent" }
  /** No account has this email. Nothing was stored or sent. */
  | { status: "unknown_user" }
  /** Five requests an hour; `resetAt` is when the next one may be made. */
  | { status: "rate_limited"; resetAt: number | undefined }
  /** The limit could not be checked, so the request is refused. */
  | { status: "limiter_unavailable" }
  | { status: "send_failed" };

/**
 * Stores a one-hour reset token for the account with this email and mails
 * the link.
 *
 * The caller must answer `unknown_user` exactly as it answers `sent`, or it
 * reveals which emails have an account.
 */
export const requestPasswordReset = async ({
  email,
}: {
  email: string;
}): Promise<RequestPasswordResetResult> => {
  const rateLimitResult = await checkPasswordResetRateLimit(email);
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

  // Only the hash is stored; the plain token exists in the email alone.
  const { token, hashedToken, expiresAt } = createPasswordResetToken();

  await setPasswordResetToken({
    userId: userRecord.id,
    hashedToken,
    expiresAt,
  });

  const emailResult = await sendPasswordResetEmail({
    email,
    resetToken: token,
  });

  if (!emailResult.success) {
    console.error("Failed to send password reset email:", emailResult.error);
    return { status: "send_failed" };
  }

  return { status: "sent" };
};
