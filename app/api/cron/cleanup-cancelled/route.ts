import { and, eq, lte } from "drizzle-orm";
import { db } from "@/lib/db/queries";
import { user, userSubscription } from "@/lib/db/schema";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const now = new Date();

  console.log("[Cron:CleanupCancelled] Checking for expired cancelled subscriptions");

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
      `[Cron:CleanupCancelled] Removing access for user ${sub.userId}, subscription ${sub.id}`
    );

    await db
      .update(user)
      .set({ currentPlan: null })
      .where(eq(user.id, sub.userId));

    if (sub.status !== "cancelled") {
      await db
        .update(userSubscription)
        .set({ status: "cancelled" })
        .where(eq(userSubscription.id, sub.id));
    }

    cleaned++;
  }

  console.log(
    `[Cron:CleanupCancelled] Cleanup completed: ${cleaned} users lost access after cancellation period ended`
  );

  return Response.json({
    cleaned,
    timestamp: now.toISOString(),
    message: `Removed access for ${cleaned} expired cancelled subscriptions.`,
  });
}

