import { compare } from "bcrypt-ts";

import type { User } from "@/server/db/schema";
import {
  beginLoginAttempt,
  recordFailedLogin,
  recordSuccessfulLogin,
} from "@/server/http/rate-limit";
import { type Account, toAccount } from "@/server/modules/auth/account";
import { DUMMY_PASSWORD } from "@/server/modules/auth/dummy-password";
import { getUserByEmail } from "@/server/modules/users/queries/get-by-email";

/** How long an attempt on an account under a guessing attack is held back. */
const THROTTLED_LOGIN_DELAY_MS = 2000;

export type CredentialsInput = {
  email: string;
  password: string;
  /** The caller's address, or null when it is not known. */
  ip: string | null;
};

export type AuthenticateCredentialsResult =
  | { status: "authenticated"; account: Account }
  | { status: "invalid_credentials" }
  /** Refused by a login limit, or the limits could not be checked. */
  | { status: "rate_limited" };

const wait = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

/**
 * The account these credentials open, or null. An unknown email and an
 * account without a password still cost one bcrypt comparison, so the answer
 * takes as long as a wrong password and does not reveal which emails exist.
 */
const findUserByCredentials = async ({
  email,
  password,
}: Pick<CredentialsInput, "email" | "password">): Promise<User | null> => {
  const userRecord = await getUserByEmail(email);

  if (!userRecord?.password) {
    await compare(password, DUMMY_PASSWORD);
    return null;
  }

  const passwordsMatch = await compare(password, userRecord.password);

  return passwordsMatch ? userRecord : null;
};

/**
 * Checks an email and password, under the login limits.
 *
 * Every way of signing in goes through here (the Auth.js `authorize` callback
 * for the web, the token endpoint for API clients), so that the limits and
 * the protection against guessing which emails exist cannot drift apart.
 */
export const authenticateCredentials = async ({
  email,
  password,
  ip,
}: CredentialsInput): Promise<AuthenticateCredentialsResult> => {
  const identity = { email, ip };

  const attempt = await beginLoginAttempt(identity);
  if (!attempt.isAllowed) {
    return { status: "rate_limited" };
  }
  if (attempt.shouldDelay) {
    await wait(THROTTLED_LOGIN_DELAY_MS);
  }

  const userRecord = await findUserByCredentials({ email, password });

  if (!userRecord) {
    await recordFailedLogin(identity);
    return { status: "invalid_credentials" };
  }

  await recordSuccessfulLogin(identity);

  return { status: "authenticated", account: toAccount(userRecord) };
};
