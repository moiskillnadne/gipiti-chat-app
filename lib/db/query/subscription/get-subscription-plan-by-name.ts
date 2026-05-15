import { eq } from "drizzle-orm";

import { ChatSDKError } from "../../../errors";
import { db } from "../../connection";
import { type SubscriptionPlan, subscriptionPlan } from "../../schema";

export async function getSubscriptionPlanByName({
  name,
}: {
  name: string;
}): Promise<SubscriptionPlan | null> {
  try {
    const [plan] = await db
      .select()
      .from(subscriptionPlan)
      .where(eq(subscriptionPlan.name, name))
      .limit(1);

    return plan || null;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get subscription plan by name"
    );
  }
}
