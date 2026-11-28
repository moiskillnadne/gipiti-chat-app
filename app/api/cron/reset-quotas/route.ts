import { and, eq, isNull, lte } from "drizzle-orm";
import type { BillingPeriod } from "@/lib/subscription/subscription-tiers";
import { isAuthorizedCronRequest } from "@/server/cron/is-authorized-cron-request";
import { db } from "@/server/db/connection";
import {
  subscription,
  type UserSubscription,
  user,
  userSubscription,
} from "@/server/db/schema";
import { resetSubscriptionPool } from "@/server/modules/billing/balance";
import { priceForCurrency } from "@/server/modules/billing/subscriptions";
import {
  calculateNextBillingDate,
  calculatePeriodEnd,
} from "@/server/modules/subscription/billing-periods";
import { decidePeriodEndAction } from "@/server/modules/subscription/period-end-action";
import { assignFreePlan } from "@/server/modules/subscription/subscription-init";

type DueSubscription = {
  sub: UserSubscription;
  billingPeriod: BillingPeriod;
  billingPeriodCount: number;
};

/**
 * Extend a tester's subscription by one billing period and reset the
 * subscription pool to the plan price. Returns whether the pool was reset.
 */
async function renewSubscription(
  { sub, billingPeriod, billingPeriodCount }: DueSubscription,
  now: Date
): Promise<boolean> {
  const newPeriodStart = sub.currentPeriodEnd;
  const newPeriodEnd = calculatePeriodEnd(
    newPeriodStart,
    billingPeriod,
    billingPeriodCount
  );
  const newBillingDate = calculateNextBillingDate(
    newPeriodStart,
    billingPeriod,
    billingPeriodCount
  );

  await db
    .update(userSubscription)
    .set({
      currentPeriodStart: newPeriodStart,
      currentPeriodEnd: newPeriodEnd,
      nextBillingDate: newBillingDate,
      updatedAt: now,
    })
    .where(eq(userSubscription.id, sub.id));

  console.log(
    `[Cron:ResetQuotas] Renewed: new period ${newPeriodStart.toISOString()} to ${newPeriodEnd.toISOString()}`
  );

  // Reset the subscription balance pool to the plan price for the new period.
  try {
    const price = await priceForCurrency(sub.subscriptionId, sub.currencyCode);

    if (price == null) {
      console.error(
        `[Cron:ResetQuotas] No ${sub.currencyCode} price for subscription ${sub.subscriptionId}, skipping pool reset`
      );
      return false;
    }

    await resetSubscriptionPool({
      userId: sub.userId,
      amount: price,
      currencyCode: sub.currencyCode,
      type: "subscription_renewal",
      referenceId: sub.id,
    });

    console.log(
      `[Cron:ResetQuotas] Subscription pool reset to ${price} for user ${sub.userId}`
    );
    return true;
  } catch (balanceError) {
    console.error(
      `[Cron:ResetQuotas] Failed to reset balance for user ${sub.userId}:`,
      balanceError
    );
    return false;
  }
}

/**
 * End a subscription whose period is not backed by a payment and move the user
 * to the free state (empty subscription pool, top-up pool untouched).
 */
async function expireSubscription(
  sub: UserSubscription,
  now: Date
): Promise<void> {
  await db
    .update(userSubscription)
    .set({ status: "expired", updatedAt: now })
    .where(eq(userSubscription.id, sub.id));

  // assignFreePlan no-ops when the user has another active subscription.
  try {
    await assignFreePlan(sub.userId);
    console.log(
      `[Cron:ResetQuotas] Expired subscription ${sub.id}, assigned free plan to user ${sub.userId}`
    );
  } catch (error) {
    console.error(
      `[Cron:ResetQuotas] Failed to assign free plan to user ${sub.userId} after expiring subscription ${sub.id}:`,
      error
    );
  }
}

export async function GET(request: Request) {
  // Verify cron secret
  if (!isAuthorizedCronRequest(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const now = new Date();

  console.log("[Cron:ResetQuotas] Starting non-recurring subscription renewal");

  // Active subscriptions whose period has ended and that are NOT backed by a
  // CloudPayments recurring subscription (externalSubscriptionId IS NULL).
  // CloudPayments-recurring subs are renewed by the webhooks instead. The
  // owner's tester flag is read from the DB: only testers are renewed here.
  const dueSubscriptions = await db
    .select({
      sub: userSubscription,
      billingPeriod: subscription.billingPeriod,
      billingPeriodCount: subscription.billingPeriodCount,
      isTester: user.isTester,
    })
    .from(userSubscription)
    .innerJoin(
      subscription,
      eq(userSubscription.subscriptionId, subscription.id)
    )
    .innerJoin(user, eq(userSubscription.userId, user.id))
    .where(
      and(
        eq(userSubscription.status, "active"),
        lte(userSubscription.currentPeriodEnd, now),
        isNull(userSubscription.externalSubscriptionId)
      )
    );

  console.log(
    `[Cron:ResetQuotas] Found ${dueSubscriptions.length} non-recurring subscriptions past period end`
  );

  let renewed = 0;
  let expired = 0;
  let balancesReset = 0;

  for (const dueSubscription of dueSubscriptions) {
    const { sub, isTester } = dueSubscription;
    const action = decidePeriodEndAction({
      externalSubscriptionId: sub.externalSubscriptionId,
      isTester,
    });

    // One failing row must not stop the others.
    try {
      if (action === "renew") {
        console.log(
          `[Cron:ResetQuotas] Renewing tester subscription ${sub.id} for user ${sub.userId}`
        );
        const isPoolReset = await renewSubscription(dueSubscription, now);
        renewed++;
        if (isPoolReset) {
          balancesReset++;
        }
      } else if (action === "expire") {
        console.log(
          `[Cron:ResetQuotas] Expiring subscription ${sub.id} for user ${sub.userId}`
        );
        await expireSubscription(sub, now);
        expired++;
      }
    } catch (error) {
      console.error(
        `[Cron:ResetQuotas] Failed to process subscription ${sub.id} (action: ${action}) for user ${sub.userId}:`,
        error
      );
    }
  }

  console.log(
    `[Cron:ResetQuotas] Completed: ${renewed} subscriptions renewed, ${expired} expired, ${balancesReset} balances reset`
  );

  return Response.json({
    renewed,
    expired,
    balancesReset,
    timestamp: now.toISOString(),
    message: `Renewed ${renewed} subscriptions, expired ${expired}, reset ${balancesReset} balances.`,
  });
}
