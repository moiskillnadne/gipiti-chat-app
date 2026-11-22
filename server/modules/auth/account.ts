import type { User } from "@/server/db/schema";

/**
 * What the auth services hand back about an account. Deliberately not the
 * whole `User` row: that holds the password hash, the verification code and
 * the reset token, and a caller that passed the row on would leak them.
 */
export type Account = Pick<User, "id" | "email" | "emailVerified" | "isTester">;

export const toAccount = ({
  id,
  email,
  emailVerified,
  isTester,
}: User): Account => ({ id, email, emailVerified, isTester });
