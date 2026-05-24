import { and, eq, isNull, lte } from "drizzle-orm";
import { resetSubscriptionPool } from "@/lib/billing/balance";
import { priceForCurrency } from "@/lib/billing/subscriptions";
import { db } from "@/lib/db/connection";
import { subscription, userSubscription } from "@/lib/db/schema";
import {
  calculateNextBillingDate,
  calculatePeriodEnd,
} from "@/lib/subscription/billing-periods";

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const now = new Date();

  console.log("[Cron:ResetQuotas] Starting non-recurring subscription renewal");

  // Renew active subscriptions whose period has ended and that are NOT backed by
  // a CloudPayments recurring subscription (externalSubscriptionId IS NULL).
  // CloudPayments-recurring subs are renewed by the recurrent webhook instead.
  const expiredSubscriptions = await db
    .select({
      sub: userSubscription,
      billingPeriod: subscription.billingPeriod,
      billingPeriodCount: subscription.billingPeriodCount,
    })
    .from(userSubscription)
    .innerJoin(
      subscription,
      eq(userSubscription.subscriptionId, subscription.id)
    )
    .where(
      and(
        eq(userSubscription.status, "active"),
        lte(userSubscription.currentPeriodEnd, now),
        isNull(userSubscription.externalSubscriptionId)
      )
    );

  console.log(
    `[Cron:ResetQuotas] Found ${expiredSubscriptions.length} non-recurring subscriptions due for renewal`
  );

  let renewed = 0;
  let balancesReset = 0;

  // Renew each subscription based on its catalog billing period and count.
  for (const {
    sub,
    billingPeriod,
    billingPeriodCount,
  } of expiredSubscriptions) {
    console.log(
      `[Cron:ResetQuotas] Renewing subscription ${sub.id} for user ${sub.userId}`
    );

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

    renewed++;

    // Reset the subscription balance pool to the plan price for the new period.
    try {
      const price = await priceForCurrency(
        sub.subscriptionId,
        sub.currencyCode
      );

      if (price == null) {
        console.error(
          `[Cron:ResetQuotas] No ${sub.currencyCode} price for subscription ${sub.subscriptionId}, skipping pool reset`
        );
        continue;
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
      balancesReset++;
    } catch (balanceError) {
      console.error(
        `[Cron:ResetQuotas] Failed to reset balance for user ${sub.userId}:`,
        balanceError
      );
      // Continue processing other users
    }
  }

  console.log(
    `[Cron:ResetQuotas] Completed: ${renewed} subscriptions renewed, ${balancesReset} balances reset`
  );

  return Response.json({
    renewed,
    balancesReset,
    timestamp: now.toISOString(),
    message: `Renewed ${renewed} subscriptions, reset ${balancesReset} balances.`,
  });
}
