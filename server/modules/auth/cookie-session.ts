import { auth } from "@/server/modules/auth/next-auth";

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
