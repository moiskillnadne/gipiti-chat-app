import { eq } from "drizzle-orm";

import { ChatSDKError } from "../../../errors";
import { db } from "../../connection";
import { type SubscriptionPlan, subscriptionPlan } from "../../schema";

export async function getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  try {
    return await db
      .select()
      .from(subscriptionPlan)
      .where(eq(subscriptionPlan.isActive, true));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get subscription plans"
    );
  }
}
