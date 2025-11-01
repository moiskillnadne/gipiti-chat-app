import { db } from "@/lib/db";
import { user, userSubscription, subscriptionPlan } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { SUBSCRIPTION_TIERS } from "./subscription-tiers";
import {
  calculatePeriodEnd,
  calculateNextBillingDate,
} from "./billing-periods";

/**
 * Assign tester plan to a new user
 */
export async function assignTesterPlan(userId: string) {
  const testerTier = SUBSCRIPTION_TIERS.tester;

  // Get or create tester plan
  let plans = await db
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
        displayName: testerTier.displayName,
        billingPeriod: testerTier.billingPeriod,
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
  const periodEnd = calculatePeriodEnd(now, testerTier.billingPeriod);
  const nextBilling = calculateNextBillingDate(now, testerTier.billingPeriod);

  await db.insert(userSubscription).values({
    userId,
    planId: plan.id,
    billingPeriod: testerTier.billingPeriod,
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
  let plans = await db
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
  const periodEnd = calculatePeriodEnd(now, tier.billingPeriod);
  const nextBilling = calculateNextBillingDate(now, tier.billingPeriod);

  await db.insert(userSubscription).values({
    userId,
    planId: plan.id,
    billingPeriod: tier.billingPeriod,
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
