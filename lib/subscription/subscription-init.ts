import { ensureBalance, resetSubscriptionPool } from "@/lib/billing/balance";
import { getActiveUserSubscription } from "@/lib/billing/subscriptions";

/**
 * Move a user to the free state: no active subscription, an empty subscription
 * pool. The persistent top-up pool (including the welcome grant) is untouched.
 * No-ops if the user still has an active subscription.
 */
export async function assignFreePlan(userId: string): Promise<void> {
  const active = await getActiveUserSubscription(userId);
  if (active) {
    console.warn(
      `[assignFreePlan] user ${userId} has active subscription ${active.id}; skipping downgrade`
    );
    return;
  }

  await ensureBalance(userId);
  await resetSubscriptionPool({
    userId,
    amount: 0,
    type: "subscription_renewal",
  });
}
