import { and, eq, inArray, isNull, lte } from "drizzle-orm";

import { isAuthorizedCronRequest } from "@/lib/cron/is-authorized-cron-request";
import { db } from "@/lib/db/connection";
import { type PaymentIntent, paymentIntent } from "@/lib/db/schema";

const LOG_PREFIX = "[Cron:CleanupPaymentIntents]";

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/** How long an intent that never became a payment is kept before deletion. */
const UNPAID_INTENT_RETENTION_DAYS = 30;

/**
 * The only statuses that may be deleted. `succeeded` intents are the record a
 * refund is matched against (the refund webhook looks the payment up by
 * `externalTransactionId`), and `pending` / `processing` ones may still
 * receive a webhook.
 */
const DELETABLE_STATUSES: PaymentIntent["status"][] = ["expired", "failed"];

/**
 * Mark pending intents past their `expiresAt` as expired. One statement, so a
 * pay webhook that settles the intent in the meantime is never overwritten:
 * the `pending` condition is re-checked on the row the update locks.
 */
const expireOverduePendingIntents = async (now: Date): Promise<number> => {
  const expiredIntents = await db
    .update(paymentIntent)
    .set({ status: "expired", updatedAt: now })
    .where(
      and(
        eq(paymentIntent.status, "pending"),
        lte(paymentIntent.expiresAt, now)
      )
    )
    .returning({ id: paymentIntent.id });

  return expiredIntents.length;
};

/**
 * Delete expired and failed intents created before the retention cutoff.
 *
 * An intent that carries a payment transaction id is kept whatever its
 * status: a failed renewal charge can flip a paid subscription intent to
 * `failed`, and deleting it would make a refund of that payment unmatchable.
 */
const deleteStaleUnpaidIntents = async (now: Date): Promise<number> => {
  const retentionCutoff = new Date(
    now.getTime() - UNPAID_INTENT_RETENTION_DAYS * MILLISECONDS_PER_DAY
  );

  const deletedIntents = await db
    .delete(paymentIntent)
    .where(
      and(
        inArray(paymentIntent.status, DELETABLE_STATUSES),
        isNull(paymentIntent.externalTransactionId),
        lte(paymentIntent.createdAt, retentionCutoff)
      )
    )
    .returning({ id: paymentIntent.id });

  return deletedIntents.length;
};

/**
 * Payment-intent housekeeping, scheduled hourly in `vercel.json`: expires
 * pending intents past their deadline, then deletes expired and failed ones
 * older than the retention period. Succeeded intents are never deleted.
 */
export async function GET(request: Request): Promise<Response> {
  if (!isAuthorizedCronRequest(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const now = new Date();

  try {
    const expired = await expireOverduePendingIntents(now);
    const deleted = await deleteStaleUnpaidIntents(now);

    console.log(
      `${LOG_PREFIX} Marked ${expired} overdue pending intents as expired, deleted ${deleted} expired or failed intents older than ${UNPAID_INTENT_RETENTION_DAYS} days`
    );

    return Response.json({
      expired,
      deleted,
      timestamp: now.toISOString(),
      message: `Marked ${expired} payment intents as expired. Deleted ${deleted} old payment intents.`,
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} Payment intent cleanup failed:`, error);

    return Response.json(
      { error: "Payment intent cleanup failed" },
      { status: 500 }
    );
  }
}
