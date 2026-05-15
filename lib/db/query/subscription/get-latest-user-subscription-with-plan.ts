import { desc, eq } from "drizzle-orm";

import { ChatSDKError } from "../../../errors";
import { db } from "../../queries";
import {
  type SubscriptionPlan,
  subscriptionPlan,
  type UserSubscription,
  userSubscription,
} from "../../schema";

/**
 * Returns the most recent subscription for a user (any status).
 * Used by the subscription dashboard to render cancelled / past_due / expired
 * states that the active-only query filters out.
 */
export async function getLatestUserSubscriptionWithPlan({
  userId,
}: {
  userId: string;
}): Promise<{
  subscription: UserSubscription;
  plan: SubscriptionPlan;
} | null> {
  try {
    const subscriptions = await db
      .select({
        subscription: userSubscription,
        plan: subscriptionPlan,
      })
      .from(userSubscription)
      .innerJoin(
        subscriptionPlan,
        eq(userSubscription.planId, subscriptionPlan.id)
      )
      .where(eq(userSubscription.userId, userId))
      .orderBy(desc(userSubscription.currentPeriodEnd))
      .limit(1);

    if (subscriptions.length === 0) {
      return null;
    }

    return subscriptions[0];
  } catch (error) {
    console.error("[getLatestUserSubscriptionWithPlan] DB error:", error);
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get latest user subscription with plan"
    );
  }
}
