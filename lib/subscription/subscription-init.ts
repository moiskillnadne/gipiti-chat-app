import { and, eq, ne } from "drizzle-orm";
import { FREE_TIER_ENTITLEMENTS } from "@/lib/ai/entitlements";
import { resetBalance } from "@/lib/ai/token-balance";
import { db } from "@/lib/db/queries";
import { balance, subscriptionPlan, userSubscription } from "@/lib/db/schema";
import {
  calculateNextBillingDate,
  calculatePeriodEnd,
} from "./billing-periods";
import { SUBSCRIPTION_TIERS } from "./subscription-tiers";

/**
 * Assign the free plan to a user.
 *
 * Free is NOT a subscription — no `subscriptionPlan` or `userSubscription` row
 * is created. We only set `User.currentPlan = "free"` and seed the balance
 * with the Tier 1 one-time bonus. Tier 2 / Tier 3 unlocks credit additional
 * tokens via `creditBalance` from the email-verification and survey flows
 * (handled in separate tickets).
 */
export async function assignFreePlan(userId: string) {
  // Safety guard: do not downgrade a user who has an active paid subscription.
  const activePaidSubs = await db
    .select({ id: userSubscription.id })
    .from(userSubscription)
    .innerJoin(
      subscriptionPlan,
      eq(userSubscription.planId, subscriptionPlan.id)
    )
    .where(
      and(
        eq(userSubscription.userId, userId),
        eq(userSubscription.status, "active"),
        eq(subscriptionPlan.isTesterPlan, false),
        ne(subscriptionPlan.name, "free")
      )
    )
    .limit(1);

  if (activePaidSubs.length > 0) {
    console.warn(
      `[assignFreePlan] Skipping: user ${userId} has active paid subscription ${activePaidSubs[0].id}`
    );
    return;
  }

  await db
    .update(balance)
    .set({ plan: "free", updatedAt: new Date() })
    .where(eq(balance.userId, userId));

  await resetBalance({
    userId,
    newBalance: FREE_TIER_ENTITLEMENTS.tier_1.tokenBonus,
    reason: "subscription_reset",
    planName: "free",
  });
}

/**
 * Upgrade user to a paid plan
 */
export async function upgradeToPlan(userId: string, planName: string) {
  const tier = SUBSCRIPTION_TIERS[planName as keyof typeof SUBSCRIPTION_TIERS];

  if (!tier) {
    throw new Error(`Unknown plan: ${planName}`);
  }

  if (tier.isTesterPlan) {
    throw new Error("Cannot upgrade to tester plan");
  }

  // Get or create plan
  const plans = await db
    .select()
    .from(subscriptionPlan)
    .where(eq(subscriptionPlan.name, planName))
    .limit(1);

  let plan = plans[0];

  if (!plan) {
    const [newPlan] = await db
      .insert(subscriptionPlan)
      .values({
        name: tier.name,
        displayName: tier.displayName,
        billingPeriod: tier.billingPeriod,
        billingPeriodCount: tier.billingPeriodCount,
        tokenQuota: tier.tokenQuota,
        features: tier.features,
        price: tier.price.toString(),
        isTesterPlan: false,
      })
      .returning();
    plan = newPlan;
  }

  // Cancel existing subscriptions
  await db
    .update(userSubscription)
    .set({
      status: "cancelled",
      cancelledAt: new Date(),
    })
    .where(
      and(
        eq(userSubscription.userId, userId),
        eq(userSubscription.status, "active")
      )
    );

  // Create new subscription
  const now = new Date();
  const periodEnd = calculatePeriodEnd(
    now,
    tier.billingPeriod,
    tier.billingPeriodCount
  );
  const nextBilling = calculateNextBillingDate(
    now,
    tier.billingPeriod,
    tier.billingPeriodCount
  );

  await db.insert(userSubscription).values({
    userId,
    planId: plan.id,
    billingPeriod: tier.billingPeriod,
    billingPeriodCount: tier.billingPeriodCount,
    currentPeriodStart: now,
    currentPeriodEnd: periodEnd,
    nextBillingDate: nextBilling,
    status: "active",
  });

  // Update user's current plan
  await db
    .update(balance)
    .set({ plan: planName, updatedAt: new Date() })
    .where(eq(balance.userId, userId));
}
