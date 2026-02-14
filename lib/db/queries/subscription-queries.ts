/**
 * Subscription and plan queries.
 * Handles subscription plan listing, active subscription lookup,
 * user subscription creation, and cancellation feedback storage.
 */
import { and, desc, eq, gt } from "drizzle-orm";

import { ChatSDKError } from "../../errors";
import { calculatePeriodEnd } from "../../subscription/billing-periods";
import {
  cancellationFeedback,
  type SubscriptionPlan,
  subscriptionPlan,
  type UserSubscription,
  userSubscription,
} from "../schema";
import { db } from "./connection";

export async function getActiveUserSubscription({
  userId,
}: {
  userId: string;
}): Promise<UserSubscription | null> {
  try {
    const now = new Date();
    const [subscription] = await db
      .select()
      .from(userSubscription)
      .where(
        and(
          eq(userSubscription.userId, userId),
          gt(userSubscription.currentPeriodEnd, now),
          eq(userSubscription.status, "active")
        )
      )
      .limit(1);

    return subscription || null;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get active user subscription"
    );
  }
}

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

export async function saveCancellationFeedback({
  userId,
  subscriptionId,
  reasons,
  additionalFeedback,
  planName,
  billingPeriod,
  subscriptionDurationDays,
  wasTrial,
}: {
  userId: string;
  subscriptionId: string;
  reasons: string[];
  additionalFeedback?: string;
  planName?: string;
  billingPeriod?: "daily" | "weekly" | "monthly" | "annual";
  subscriptionDurationDays?: number;
  wasTrial: boolean;
}): Promise<void> {
  try {
    await db.insert(cancellationFeedback).values({
      userId,
      subscriptionId,
      reasons,
      additionalFeedback: additionalFeedback || null,
      planName: planName || null,
      billingPeriod: billingPeriod || null,
      subscriptionDurationDays: subscriptionDurationDays || null,
      wasTrial,
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to save cancellation feedback"
    );
  }
}
