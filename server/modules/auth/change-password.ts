import { generateHashedPassword } from "@/server/db/utils";
import { type Account, toAccount } from "@/server/modules/auth/account";
import { authenticateCredentials } from "@/server/modules/auth/authenticate-credentials";
import { isAcceptablePassword } from "@/server/modules/auth/password-policy";
import { rememberTokenVersion } from "@/server/modules/auth/token-version";
import { sendPasswordChangedEmail } from "@/server/modules/email/send-password-changed";
import { getUserById } from "@/server/modules/users/queries/get-by-id";
import { updateUserPassword } from "@/server/modules/users/queries/update-user-password";

export type ChangePasswordResult =
  /** `account` carries the token version the account has after the change. */
  | { status: "password_changed"; account: Account }
  /** The current password is wrong, or the account is gone. */
  | { status: "invalid_credentials" }
  | { status: "weak_password" }
  /** Too many wrong passwords for this account or from this address. */
  | { status: "rate_limited" }
  /** The login limits could not be checked, so the attempt is refused. */
  | { status: "limiter_unavailable" };

/**
 * Changes the password of a signed-in account, on proof of the current one.
 *
 * The current password is checked by `authenticateCredentials`, so guessing
 * it through here is held back by the same limits as guessing it at login.
 *
 * A changed password ends **every** session of the account, the caller's
 * included (`updateUserPassword` raises the token version and revokes the
 * API sessions): whoever made the owner change it is locked out at once. The
 * caller is responsible for giving the user a new session.
 */
export const changePassword = async ({
  userId,
  currentPassword,
  newPassword,
  ip,
}: {
  userId: string;
  currentPassword: string;
  newPassword: string;
  /** The caller's address, or null when it is not known. */
  ip: string | null;
}): Promise<ChangePasswordResult> => {
  // Checked first: it needs no lookup and spends no login attempt.
  if (!isAcceptablePassword(newPassword)) {
    return { status: "weak_password" };
  }

  const userRecord = await getUserById(userId);
  if (!userRecord) {
    return { status: "invalid_credentials" };
  }

  const authentication = await authenticateCredentials({
    email: userRecord.email,
    password: currentPassword,
    ip,
  });

  if (authentication.status !== "authenticated") {
    return { status: authentication.status };
  }

  const [updatedUser] = await updateUserPassword({
    userId,
    hashedPassword: generateHashedPassword(newPassword),
  });

  // The account was deleted while its password was being checked.
  if (!updatedUser) {
    return { status: "invalid_credentials" };
  }

  await rememberTokenVersion(updatedUser.id, updatedUser.tokenVersion);

  // The notice is a courtesy; the sender reports a failure, it does not throw.
  await sendPasswordChangedEmail({ email: userRecord.email });

  return { status: "password_changed", account: toAccount(updatedUser) };
};
