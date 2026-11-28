import { and, eq, gt } from "drizzle-orm";
import { ChatSDKError } from "@/lib/errors";
import { db } from "@/server/db/connection";
import { type UserSubscription, userSubscription } from "@/server/db/schema";

/**
 * The user's subscription row that has `status = 'active'` AND a period end
 * in the future, or null. A row whose period has run out but whose status the
 * renewal webhook or cron has not changed yet is NOT returned.
 *
 * `getActiveStatusSubscription` in `server/modules/billing/subscriptions.ts`
 * looks at the status only and ignores the period end.
 */
export async function getActiveUserSubscription({
  userId,
}: {
  userId: string;
}): Promise<UserSubscription | null> {
  try {
    const now = new Date();
    const [subscription] = await db
      .select()
      .from(userSubscription)
      .where(
        and(
          eq(userSubscription.userId, userId),
          gt(userSubscription.currentPeriodEnd, now),
          eq(userSubscription.status, "active")
        )
      )
      .limit(1);

    return subscription || null;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get active user subscription"
    );
  }
}
