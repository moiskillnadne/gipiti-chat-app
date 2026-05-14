import { and, eq, lte, ne } from "drizzle-orm";
import { resetBalance } from "@/lib/ai/token-balance";
import { db } from "@/lib/db/queries";
import { subscriptionPlan, userSubscription } from "@/lib/db/schema";
import {
  calculateNextBillingDate,
  calculatePeriodEnd,
} from "@/lib/subscription/billing-periods";
import { buildRefillFromTier } from "@/lib/subscription/refill";
import { SUBSCRIPTION_TIERS } from "@/lib/subscription/subscription-tiers";

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const now = new Date();
  // Renew slightly before expiry so users don't see a gap between the period
  // ending and the next cron tick. Cron must run at least hourly for this to
  // cover every sub.
  const renewalLookahead = new Date(now.getTime() + 30 * 60 * 1000);

  console.log("[Cron:ResetQuotas] Starting quota reset for unlim plan");

  // Find unlim plan subscriptions whose period has ended or is ending within
  // the next hour. Paid plans (including tester_paid) use CloudPayments
  // webhooks for resets. Free and legacy tester plans no longer receive
  // cron refreshes.
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
        lte(userSubscription.currentPeriodEnd, renewalLookahead),
        eq(subscriptionPlan.name, "unlim")
      )
    );

  console.log(
    `[Cron:ResetQuotas] Found ${expiredSubscriptions.length} unlim subscriptions due for renewal`
  );

  let renewed = 0;
  let balancesReset = 0;

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

    // Check if user has an active paid subscription (orphaned unlim sub guard)
    const paidSub = await db
      .select({ id: userSubscription.id })
      .from(userSubscription)
      .innerJoin(
        subscriptionPlan,
        eq(userSubscription.planId, subscriptionPlan.id)
      )
      .where(
        and(
          eq(userSubscription.userId, sub.userId),
          eq(userSubscription.status, "active"),
          ne(subscriptionPlan.name, "unlim")
        )
      )
      .limit(1);

    if (paidSub.length > 0) {
      console.log(
        `[Cron:ResetQuotas] User ${sub.userId} has active paid subscription ${paidSub[0].id}, skipping unlim balance reset`
      );
      continue;
    }

    // Reset token balance + quota counters to plan quota
    try {
      const tier = SUBSCRIPTION_TIERS[plan.name];
      const refill = tier
        ? buildRefillFromTier(tier)
        : { newBalance: plan.tokenQuota };
      await resetBalance({
        userId: sub.userId,
        ...refill,
        plan: plan.name,
        reason: "subscription_reset",
        referenceId: sub.id,
        planName: plan.name,
        subscriptionId: sub.id,
      });
      console.log(
        `[Cron:ResetQuotas] Token balance reset to ${plan.tokenQuota} for user ${sub.userId}`
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
