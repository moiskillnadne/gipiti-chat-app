import { and, eq, gt } from "drizzle-orm";

import { ChatSDKError } from "../../../errors";
import { db } from "../../queries";
import { type UserSubscription, userSubscription } from "../../schema";

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
