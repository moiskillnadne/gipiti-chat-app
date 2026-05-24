import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/connection";
import {
  type Subscription,
  subscription,
  subscriptionPrice,
  type UserSubscription,
  userSubscription,
} from "@/lib/db/schema";

/**
 * Look up a subscription catalog entry by its stable code (e.g. "basic_monthly").
 */
export async function getSubscriptionByCode(
  code: string
): Promise<Subscription | null> {
  const [row] = await db
    .select()
    .from(subscription)
    .where(eq(subscription.code, code))
    .limit(1);

  return row ?? null;
}

/**
 * Active price (minor units) for a subscription in a given currency. This is
 * both what the user pays and what is credited to the subscription pool on
 * renewal (1:1).
 */
export async function priceForCurrency(
  subscriptionId: string,
  currencyCode: string
): Promise<number | null> {
  const [row] = await db
    .select({ price: subscriptionPrice.price })
    .from(subscriptionPrice)
    .where(
      and(
        eq(subscriptionPrice.subscriptionId, subscriptionId),
        eq(subscriptionPrice.currencyCode, currencyCode),
        eq(subscriptionPrice.isActive, true)
      )
    )
    .limit(1);

  return row ? row.price : null;
}

/**
 * The user's single active subscription, or null for free users.
 */
export async function getActiveUserSubscription(
  userId: string
): Promise<UserSubscription | null> {
  const [row] = await db
    .select()
    .from(userSubscription)
    .where(
      and(
        eq(userSubscription.userId, userId),
        eq(userSubscription.status, "active")
      )
    )
    .limit(1);

  return row ?? null;
}
