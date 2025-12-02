import { and, eq, lte } from "drizzle-orm";
import { db } from "@/lib/db/queries";
import { userSubscription } from "@/lib/db/schema";
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

  // Find all subscriptions with expired periods
  const expiredSubscriptions = await db
    .select()
    .from(userSubscription)
    .where(
      and(
        eq(userSubscription.status, "active"),
        lte(userSubscription.currentPeriodEnd, now)
      )
    );

  let renewed = 0;

  // Renew each subscription based on its billing period and count
  for (const sub of expiredSubscriptions) {
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

    renewed++;
  }

  return Response.json({
    renewed,
    timestamp: now.toISOString(),
    message: `Successfully renewed ${renewed} subscriptions across all billing periods`,
  });
}
