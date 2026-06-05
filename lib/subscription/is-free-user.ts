import { getActiveUserSubscription } from "@/lib/db/query/subscription/get-active-user-subscription";
import { getUserById } from "@/lib/db/query/user/get-by-id";

/**
 * Determine whether a user is on the free tier using a fresh database read.
 *
 * A "free" user has no active paid subscription and is not an internal tester.
 * This intentionally does NOT read the session JWT: `hasActiveSubscription` and
 * `isTester` are baked into the token at login and only refresh on an explicit
 * session update, so a token can be stale (e.g. after a trial expires). Used to
 * gate free-tier-only treatments such as watermarking generated images.
 */
export async function isFreeUserById(userId: string): Promise<boolean> {
  const [userRecord, subscription] = await Promise.all([
    getUserById(userId),
    getActiveUserSubscription({ userId }),
  ]);

  const isTester = userRecord?.isTester ?? false;
  const hasActiveSubscription = subscription !== null;

  return !(hasActiveSubscription || isTester);
}
