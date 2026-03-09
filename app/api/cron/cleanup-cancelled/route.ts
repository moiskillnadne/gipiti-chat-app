import { and, eq, lte } from "drizzle-orm";
import { db, getActiveUserSubscription } from "@/lib/db/queries";
import { userSubscription } from "@/lib/db/schema";
import { assignFreePlan } from "@/lib/subscription/subscription-init";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const now = new Date();

  console.log(
    "[Cron:CleanupCancelled] Checking for expired cancelled subscriptions"
  );

  const expiredCancelled = await db
    .select()
    .from(userSubscription)
    .where(
      and(
        eq(userSubscription.cancelAtPeriodEnd, true),
        lte(userSubscription.currentPeriodEnd, now),
        eq(userSubscription.status, "active")
      )
    );

  console.log(
    `[Cron:CleanupCancelled] Found ${expiredCancelled.length} cancelled subscriptions past period end`
  );

  let cleaned = 0;

  for (const sub of expiredCancelled) {
    console.log(
      `[Cron:CleanupCancelled] Processing user ${sub.userId}, subscription ${sub.id}`
    );

    // Mark this subscription as cancelled
    await db
      .update(userSubscription)
      .set({ status: "cancelled", cancelledAt: now })
      .where(eq(userSubscription.id, sub.id));

    // Check if user has another active subscription before downgrading
    const activeSub = await getActiveUserSubscription({
      userId: sub.userId,
    });

    if (activeSub) {
      console.log(
        `[Cron:CleanupCancelled] User ${sub.userId} has active subscription ${activeSub.id}, skipping free plan assignment`
      );
      cleaned++;
      continue;
    }

    // No other active subscription — downgrade to free plan
    try {
      await assignFreePlan(sub.userId);
      console.log(
        `[Cron:CleanupCancelled] Assigned free plan to user ${sub.userId}`
      );
    } catch (error) {
      console.error(
        `[Cron:CleanupCancelled] Failed to assign free plan to user ${sub.userId}:`,
        error
      );
    }

    cleaned++;
  }

  console.log(
    `[Cron:CleanupCancelled] Cleanup completed: ${cleaned} users downgraded to free plan after cancellation period ended`
  );

  return Response.json({
    cleaned,
    timestamp: now.toISOString(),
    message: `Downgraded ${cleaned} expired cancelled subscriptions to free plan.`,
  });
}
