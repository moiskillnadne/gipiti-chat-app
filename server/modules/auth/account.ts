import type { User } from "@/server/db/schema";

/**
 * What the auth services hand back about an account. Deliberately not the
 * whole `User` row: that holds the password hash, the verification code and
 * the reset token, and a caller that passed the row on would leak them.
 */
export type Account = Pick<
  User,
  "id" | "email" | "emailVerified" | "isTester" | "tokenVersion"
>;

/**
 * `tokenVersion` is the version the row had when it was read, together with
 * the password hash that was then checked. A session issued for this account
 * is stamped with that number, not with whatever the account has a moment
 * later: if the password was reset in between, the session is born dead.
 */
export const toAccount = ({
  id,
  email,
  emailVerified,
  isTester,
  tokenVersion,
}: User): Account => ({ id, email, emailVerified, isTester, tokenVersion });
