import { and, eq } from "drizzle-orm";
import { ensureBalance, resetSubscriptionPool } from "@/lib/billing/balance";
import {
  getActiveUserSubscription,
  getSubscriptionByCode,
  priceForCurrency,
} from "@/lib/billing/subscriptions";
import { userSubscription } from "@/lib/db/schema";
import { db } from "../db/connection";
import {
  calculateNextBillingDate,
  calculatePeriodEnd,
} from "./billing-periods";

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

/**
 * Subscribe a user to a paid plan by its catalog code. Cancels any existing
 * active subscription, creates a new one in the user's balance currency, and
 * credits the subscription pool with the plan price (1:1).
 */
export async function upgradeToPlan(
  userId: string,
  code: string
): Promise<void> {
  const sub = await getSubscriptionByCode(code);
  if (!sub) {
    throw new Error(`Unknown subscription: ${code}`);
  }

  const balanceRow = await ensureBalance(userId);
  const price = await priceForCurrency(sub.id, balanceRow.currencyCode);
  if (price == null) {
    throw new Error(
      `No ${balanceRow.currencyCode} price configured for subscription ${code}`
    );
  }

  // Cancel any existing active subscription.
  await db
    .update(userSubscription)
    .set({ status: "cancelled", cancelledAt: new Date() })
    .where(
      and(
        eq(userSubscription.userId, userId),
        eq(userSubscription.status, "active")
      )
    );

  const now = new Date();
  const periodEnd = calculatePeriodEnd(
    now,
    sub.billingPeriod,
    sub.billingPeriodCount
  );
  const nextBilling = calculateNextBillingDate(
    now,
    sub.billingPeriod,
    sub.billingPeriodCount
  );

  await db.insert(userSubscription).values({
    userId,
    subscriptionId: sub.id,
    currencyCode: balanceRow.currencyCode,
    currentPeriodStart: now,
    currentPeriodEnd: periodEnd,
    nextBillingDate: nextBilling,
    status: "active",
  });

  await resetSubscriptionPool({
    userId,
    amount: price,
    type: "subscription_purchase",
    metadata: { subscriptionCode: code, subscriptionId: sub.id },
  });
}
