import { auth, signIn } from "@/server/modules/auth/next-auth";

/**
 * The account of the browser session that the current request carries, or
 * null. Goes through Auth.js, so a cookie whose token version is no longer
 * the account's counts as no session.
 *
 * Reads the cookies of the request in flight (`next/headers` inside Auth.js),
 * so it works only while a request is being handled.
 */
export const getCookieSessionUserId = async (): Promise<string | null> => {
  const session = await auth();

  return session?.user?.id ?? null;
};

/**
 * Gives the browser a fresh session cookie for an account whose password is
 * known to be `password`. Used after a password change, which ends every
 * session of the account, the browser's own included.
 *
 * Signs in through Auth.js, as the login form does, so the new cookie is
 * issued under the account's new token version. Writes the cookie of the
 * response in flight, so it works only inside a route handler or an action.
 */
export const renewCookieSession = async ({
  email,
  password,
}: {
  email: string;
  password: string;
}): Promise<void> => {
  await signIn("credentials", { email, password, redirect: false });
};
