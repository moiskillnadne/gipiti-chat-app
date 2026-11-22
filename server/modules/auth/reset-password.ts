import { generateHashedPassword } from "@/server/db/utils";
import { isAcceptablePassword } from "@/server/modules/auth/password-policy";
import { hashToken } from "@/server/modules/auth/reset-token";
import { rememberTokenVersion } from "@/server/modules/auth/token-version";
import { sendPasswordChangedEmail } from "@/server/modules/email/send-password-changed";
import { getUserByResetToken } from "@/server/modules/users/queries/get-user-by-reset-token";
import { updateUserPassword } from "@/server/modules/users/queries/update-user-password";

export type ResetPasswordResult =
  | { status: "password_reset" }
  /** No account holds this token, or the token is older than its hour. */
  | { status: "invalid_token" }
  | { status: "weak_password" };

/**
 * Sets a new password for the account that holds this reset token, spends
 * the token, ends every session of the account, and tells the owner by email
 * that the password changed.
 */
export const resetPassword = async ({
  token,
  password,
}: {
  /** The plain token from the emailed link. */
  token: string;
  password: string;
}): Promise<ResetPasswordResult> => {
  if (!isAcceptablePassword(password)) {
    return { status: "weak_password" };
  }

  // The database holds the hash of the token, never the token.
  const foundUser = await getUserByResetToken({
    hashedToken: hashToken(token),
  });

  if (!foundUser) {
    return { status: "invalid_token" };
  }

  const [updatedUser] = await updateUserPassword({
    userId: foundUser.id,
    hashedPassword: generateHashedPassword(password),
  });

  // The update raised the account's token version; sessions issued under
  // the old one are refused from the moment the cache knows the new number.
  if (updatedUser) {
    await rememberTokenVersion(updatedUser.id, updatedUser.tokenVersion);
  }

  // The notice is a courtesy: the password is already changed, and the
  // sender reports a failure instead of throwing.
  await sendPasswordChangedEmail({ email: foundUser.email });

  return { status: "password_reset" };
};
