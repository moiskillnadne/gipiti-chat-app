import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/queries";
import { subscriptionPlan, user, userSubscription } from "@/lib/db/schema";
import {
  calculateNextBillingDate,
  calculatePeriodEnd,
} from "./billing-periods";
import { SUBSCRIPTION_TIERS } from "./subscription-tiers";

/**
 * Assign tester plan to a new user
 */
export async function assignTesterPlan(userId: string) {
  const testerTier = SUBSCRIPTION_TIERS.tester;

  // Get or create tester plan
  const plans = await db
    .select()
    .from(subscriptionPlan)
    .where(eq(subscriptionPlan.name, "tester"))
    .limit(1);

  let plan = plans[0];

  if (!plan) {
    // Create tester plan
    const [newPlan] = await db
      .insert(subscriptionPlan)
      .values({
        name: testerTier.name,
        displayName: testerTier.displayName.en,
        billingPeriod: testerTier.billingPeriod,
        billingPeriodCount: testerTier.billingPeriodCount,
        tokenQuota: testerTier.tokenQuota,
        features: testerTier.features as any,
        price: testerTier.price.toString(),
        isTesterPlan: true,
      })
      .returning();
    plan = newPlan;
  }

  // Create subscription
  const now = new Date();
  const periodEnd = calculatePeriodEnd(
    now,
    testerTier.billingPeriod,
    testerTier.billingPeriodCount
  );
  const nextBilling = calculateNextBillingDate(
    now,
    testerTier.billingPeriod,
    testerTier.billingPeriodCount
  );

  await db.insert(userSubscription).values({
    userId,
    planId: plan.id,
    billingPeriod: testerTier.billingPeriod,
    billingPeriodCount: testerTier.billingPeriodCount,
    currentPeriodStart: now,
    currentPeriodEnd: periodEnd,
    nextBillingDate: nextBilling,
    status: "active",
  });

  // Update user's current plan
  await db
    .update(user)
    .set({ currentPlan: "tester" })
    .where(eq(user.id, userId));
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
        displayName: tier.displayName.en,
        billingPeriod: tier.billingPeriod,
        billingPeriodCount: tier.billingPeriodCount,
        tokenQuota: tier.tokenQuota,
        features: tier.features as any,
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
    .update(user)
    .set({ currentPlan: planName })
    .where(eq(user.id, userId));
}
