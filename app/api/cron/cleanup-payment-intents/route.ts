import { and, eq, isNull, lte, or } from "drizzle-orm";

import { isAuthorizedCronRequest } from "@/lib/cron/is-authorized-cron-request";
import { db } from "@/lib/db/connection";
import { paymentIntent } from "@/lib/db/schema";

const LOG_PREFIX = "[Cron:CleanupPaymentIntents]";

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/** How long an intent that never became a payment is kept before deletion. */
const UNPAID_INTENT_RETENTION_DAYS = 30;

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
 * Delete intents that never became a payment and were created before the
 * retention cutoff. An intent is deleted only when all of these hold:
 *
 * - it carries no payment transaction id. The refund webhook matches a refund
 *   to its payment by `externalTransactionId`, and a failed renewal charge can
 *   flip a paid subscription intent to `failed`, so such a row is kept
 *   whatever its status;
 * - its status is `failed`, or `expired` with no `failureReason`. A failure
 *   reason on an expired intent means the pay webhook charged an amount that
 *   did not match the intent: it recorded the mismatch, credited nothing and
 *   left the intent pending. That row is the only database record of a
 *   payment that needs manual reconciliation, so it is kept. A `failed`
 *   intent's reason is just the decline reason.
 *
 * `succeeded` intents are never deleted (refunds are matched against them),
 * nor are `pending` / `processing` ones, which may still receive a webhook.
 */
const deleteStaleUnpaidIntents = async (now: Date): Promise<number> => {
  const retentionCutoff = new Date(
    now.getTime() - UNPAID_INTENT_RETENTION_DAYS * MILLISECONDS_PER_DAY
  );

  const isDeclined = eq(paymentIntent.status, "failed");
  const isExpiredWithoutPaymentProblem = and(
    eq(paymentIntent.status, "expired"),
    isNull(paymentIntent.failureReason)
  );

  const deletedIntents = await db
    .delete(paymentIntent)
    .where(
      and(
        or(isDeclined, isExpiredWithoutPaymentProblem),
        isNull(paymentIntent.externalTransactionId),
        lte(paymentIntent.createdAt, retentionCutoff)
      )
    )
    .returning({ id: paymentIntent.id });

  return deletedIntents.length;
};

/**
 * Payment-intent housekeeping, scheduled hourly in `vercel.json`: expires
 * pending intents past their deadline, then deletes failed and expired ones
 * older than the retention period that record neither a payment nor a payment
 * problem (the exact rule is on `deleteStaleUnpaidIntents`). Succeeded intents
 * are never deleted.
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
      `${LOG_PREFIX} Marked ${expired} overdue pending intents as expired, deleted ${deleted} unpaid expired or failed intents older than ${UNPAID_INTENT_RETENTION_DAYS} days`
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
