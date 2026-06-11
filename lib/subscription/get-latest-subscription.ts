import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/connection";
import { subscription, userSubscription } from "@/lib/db/schema";

export type BillingPeriodKey = "daily" | "weekly" | "monthly" | "annual";

export type LatestSubscription = {
  subscription: typeof userSubscription.$inferSelect;
  displayName: string | null;
  billingPeriod: BillingPeriodKey;
};

/**
 * The user's most recent subscription row (by period end) joined with its
 * catalog entry, or null when the user never subscribed. Shared between the
 * subscription dashboard and the top-up gating check.
 */
export async function getLatestSubscription(
  userId: string
): Promise<LatestSubscription | null> {
  const [row] = await db
    .select({
      subscription: userSubscription,
      displayName: subscription.displayName,
      billingPeriod: subscription.billingPeriod,
    })
    .from(userSubscription)
    .innerJoin(
      subscription,
      eq(userSubscription.subscriptionId, subscription.id)
    )
    .where(eq(userSubscription.userId, userId))
    .orderBy(desc(userSubscription.currentPeriodEnd))
    .limit(1);

  if (!row) {
    return null;
  }

  return {
    subscription: row.subscription,
    displayName: row.displayName,
    billingPeriod: row.billingPeriod as BillingPeriodKey,
  };
}
