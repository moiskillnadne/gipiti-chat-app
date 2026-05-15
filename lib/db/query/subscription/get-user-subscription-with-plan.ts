import { and, desc, eq, gt } from "drizzle-orm";

import { ChatSDKError } from "../../../errors";
import { db } from "../../queries";
import {
  type SubscriptionPlan,
  subscriptionPlan,
  type UserSubscription,
  userSubscription,
} from "../../schema";

export async function getUserSubscriptionWithPlan({
  userId,
}: {
  userId: string;
}): Promise<{
  subscription: UserSubscription;
  plan: SubscriptionPlan;
} | null> {
  try {
    const now = new Date();
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
      .where(
        and(
          eq(userSubscription.userId, userId),
          gt(userSubscription.currentPeriodEnd, now),
          eq(userSubscription.status, "active")
        )
      )
      .orderBy(desc(userSubscription.currentPeriodEnd))
      .limit(1);

    if (subscriptions.length === 0) {
      return null;
    }

    return subscriptions[0];
  } catch (error) {
    console.error("[getUserSubscriptionWithPlan] DB error:", error);
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get user subscription with plan"
    );
  }
}
