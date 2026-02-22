import { and, eq, lte } from "drizzle-orm";
import { db } from "@/lib/db/queries";
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
        lte(userSubscription.currentPeriodEnd, now)
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

    // Mark the old subscription as cancelled
    if (sub.status !== "cancelled") {
      await db
        .update(userSubscription)
        .set({ status: "cancelled" })
        .where(eq(userSubscription.id, sub.id));
    }

    // Downgrade user to free plan instead of leaving them with null plan
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
