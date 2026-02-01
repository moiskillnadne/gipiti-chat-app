import { and, eq, lte } from "drizzle-orm";
import { db } from "@/lib/db/queries";
import { userSubscription } from "@/lib/db/schema";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const now = new Date();

  console.log("[Cron:CleanupExpiredTrials] Checking for expired trials");

  // Find trials where trialEndsAt has passed but isTrial is still true
  const expiredTrials = await db
    .select()
    .from(userSubscription)
    .where(
      and(
        eq(userSubscription.isTrial, true),
        lte(userSubscription.trialEndsAt, now),
        eq(userSubscription.status, "active")
      )
    );

  console.log(
    `[Cron:CleanupExpiredTrials] Found ${expiredTrials.length} expired trials`
  );

  let converted = 0;

  for (const sub of expiredTrials) {
    console.log(
      `[Cron:CleanupExpiredTrials] Converting expired trial for user ${sub.userId}, subscription ${sub.id}`
    );

    await db
      .update(userSubscription)
      .set({
        isTrial: false,
        trialEndsAt: null,
        updatedAt: now,
      })
      .where(eq(userSubscription.id, sub.id));

    converted++;
  }

  console.log(
    `[Cron:CleanupExpiredTrials] Conversion completed: ${converted} trials converted to active`
  );

  return Response.json({
    converted,
    timestamp: now.toISOString(),
    message: `Converted ${converted} expired trials to active subscriptions.`,
  });
}
