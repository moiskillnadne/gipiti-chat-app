import { and, eq, lte } from "drizzle-orm";
import { db } from "@/lib/db/queries";
import { subscriptionPlan, userSubscription } from "@/lib/db/schema";
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

  console.log("[Cron:ResetQuotas] Starting quota reset for free tester plans");

  // Find only FREE tester plan subscriptions with expired periods
  // Paid plans (including tester_paid) use CloudPayments webhooks for resets
  const expiredSubscriptions = await db
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
        eq(userSubscription.status, "active"),
        lte(userSubscription.currentPeriodEnd, now),
        eq(subscriptionPlan.name, "tester") // Only free tester plan
      )
    );

  console.log(
    `[Cron:ResetQuotas] Found ${expiredSubscriptions.length} expired tester subscriptions`
  );

  let renewed = 0;

  // Renew each subscription based on its billing period and count
  for (const { subscription: sub, plan } of expiredSubscriptions) {
    console.log(
      `[Cron:ResetQuotas] Renewing subscription ${sub.id} for user ${sub.userId}, plan: ${plan.name}`
    );

    const newPeriodStart = sub.currentPeriodEnd;
    const newPeriodEnd = calculatePeriodEnd(
      newPeriodStart,
      sub.billingPeriod,
      sub.billingPeriodCount
    );
    const newBillingDate = calculateNextBillingDate(
      newPeriodStart,
      sub.billingPeriod,
      sub.billingPeriodCount
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
  }

  console.log(
    `[Cron:ResetQuotas] Completed: ${renewed} tester subscriptions renewed`
  );

  return Response.json({
    renewed,
    timestamp: now.toISOString(),
    message: `Successfully renewed ${renewed} free tester plan subscriptions. Paid plans use webhooks.`,
  });
}
