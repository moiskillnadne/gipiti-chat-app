import { ChatSDKError } from "../../../errors";
import { calculatePeriodEnd } from "../../../subscription/billing-periods";
import { db } from "../../connection";
import { type UserSubscription, userSubscription } from "../../schema";

export async function createUserSubscription({
  userId,
  planId,
  billingPeriod,
  billingPeriodCount = 1,
}: {
  userId: string;
  planId: string;
  billingPeriod: "daily" | "weekly" | "monthly" | "annual";
  billingPeriodCount?: number;
}): Promise<UserSubscription> {
  try {
    const now = new Date();
    const periodEnd = calculatePeriodEnd(
      now,
      billingPeriod,
      billingPeriodCount
    );
    const nextBillingDate = periodEnd;

    const [subscription] = await db
      .insert(userSubscription)
      .values({
        userId,
        planId,
        billingPeriod,
        billingPeriodCount,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        nextBillingDate,
        status: "active",
      })
      .returning();

    return subscription;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to create user subscription"
    );
  }
}
