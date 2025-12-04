import { and, eq, lte } from "drizzle-orm";
import { db } from "@/lib/db/queries";
import { paymentIntent } from "@/lib/db/schema";

/**
 * Cleanup expired payment intents
 * This cron job runs periodically to mark expired payment intents as "expired"
 * and clean up old records to prevent database bloat
 *
 * Should be scheduled to run every hour via Vercel Cron or similar
 */
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const now = new Date();

  console.log("[Cron:CleanupPaymentIntents] Starting payment intent cleanup");

  // Find expired payment intents that are still pending
  const expiredIntents = await db
    .select()
    .from(paymentIntent)
    .where(
      and(
        eq(paymentIntent.status, "pending"),
        lte(paymentIntent.expiresAt, now)
      )
    );

  console.log(
    `[Cron:CleanupPaymentIntents] Found ${expiredIntents.length} expired pending payment intents`
  );

  let expired = 0;

  // Mark each expired intent as "expired"
  for (const intent of expiredIntents) {
    console.log(
      `[Cron:CleanupPaymentIntents] Marking intent ${intent.sessionId} as expired`
    );

    await db
      .update(paymentIntent)
      .set({
        status: "expired",
        updatedAt: now,
      })
      .where(eq(paymentIntent.id, intent.id));

    expired++;
  }

  console.log(
    `[Cron:CleanupPaymentIntents] Marked ${expired} payment intents as expired`
  );

  // Optional: Delete old payment intents (older than 30 days) to prevent database bloat
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const oldIntents = await db
    .select()
    .from(paymentIntent)
    .where(lte(paymentIntent.createdAt, thirtyDaysAgo));

  console.log(
    `[Cron:CleanupPaymentIntents] Found ${oldIntents.length} payment intents older than 7 days`
  );

  let deleted = 0;

  for (const intent of oldIntents) {
    await db.delete(paymentIntent).where(eq(paymentIntent.id, intent.id));
    deleted++;
  }

  console.log(
    `[Cron:CleanupPaymentIntents] Deleted ${deleted} old payment intents`
  );

  console.log(
    `[Cron:CleanupPaymentIntents] Cleanup completed: ${expired} expired, ${deleted} deleted`
  );

  return Response.json({
    expired,
    deleted,
    timestamp: now.toISOString(),
    message: `Marked ${expired} payment intents as expired. Deleted ${deleted} old payment intents.`,
  });
}
