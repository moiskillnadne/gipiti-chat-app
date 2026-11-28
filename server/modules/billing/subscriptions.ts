import { and, asc, eq } from "drizzle-orm";
import { db } from "@/server/db/connection";
import {
  type Subscription,
  subscription,
  subscriptionPrice,
  type UserSubscription,
  userSubscription,
} from "@/server/db/schema";

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
export async function getActiveStatusSubscription(
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

export type SubscriptionWithPrices = {
  subscription: Subscription;
  /** Active prices, one per currency, in minor units. */
  prices: { currencyCode: string; price: number }[];
};

/**
 * The catalog on sale: every active subscription that has at least one active
 * price, ordered by code, each with its prices ordered by currency.
 *
 * Tester-only plans are included; callers decide who may see them
 * (`isSubscriptionPurchaseAllowed` in `tester-plans.ts`).
 */
export async function listActiveSubscriptionsWithPrices(): Promise<
  SubscriptionWithPrices[]
> {
  const rows = await db
    .select({
      subscription,
      currencyCode: subscriptionPrice.currencyCode,
      price: subscriptionPrice.price,
    })
    .from(subscription)
    .innerJoin(
      subscriptionPrice,
      and(
        eq(subscriptionPrice.subscriptionId, subscription.id),
        eq(subscriptionPrice.isActive, true)
      )
    )
    .where(eq(subscription.isActive, true))
    .orderBy(asc(subscription.code), asc(subscriptionPrice.currencyCode));

  const catalog = new Map<string, SubscriptionWithPrices>();

  for (const { subscription: row, currencyCode, price } of rows) {
    const entry = catalog.get(row.id) ?? { subscription: row, prices: [] };
    entry.prices.push({ currencyCode, price });
    catalog.set(row.id, entry);
  }

  return [...catalog.values()];
}
