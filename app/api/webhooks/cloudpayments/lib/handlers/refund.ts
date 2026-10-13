import { and, eq } from "drizzle-orm";

import { getMinorUnits } from "@/lib/billing/currencies";
import { majorToMinorUnits } from "@/lib/billing/money";
import { applyPaymentRefund } from "@/lib/billing/refund";
import { db } from "@/lib/db/connection";
import {
  type PaymentIntent,
  paymentIntent,
  userSubscription,
} from "@/lib/db/schema";
import { cancelSubscription } from "@/lib/payments/cloudpayments";
import type { CloudPaymentsRefundWebhook } from "@/lib/payments/cloudpayments-types";

import { toNumber, toTransactionId } from "./utils";

const LOG_PREFIX = "[CloudPayments:Refund]";

/**
 * Handle a Refund notification: take the refunded money back off the balance
 * pool the payment was credited to and, when a subscription payment is fully
 * refunded, stop the subscription right away.
 *
 * CloudPayments only accepts `code: 0` for refunds. Unfixable payloads are
 * logged for manual reconciliation and acknowledged; unexpected errors return
 * 13 so the notification is retried (the refund id makes retries idempotent).
 */
export async function handleRefundWebhook(
  payload: CloudPaymentsRefundWebhook
): Promise<Response> {
  const refundTransactionId = toTransactionId(payload.TransactionId);
  const paymentTransactionId = toTransactionId(payload.PaymentTransactionId);
  const amountValue = toNumber(payload.Amount);

  console.log(
    `${LOG_PREFIX} Refund ${refundTransactionId} of payment ${paymentTransactionId}, amount ${payload.Amount}, account ${payload.AccountId}`
  );

  if (!(refundTransactionId && paymentTransactionId) || !amountValue) {
    console.error(
      `${LOG_PREFIX} Malformed refund payload, manual reconciliation required:`,
      JSON.stringify(payload)
    );
    return Response.json({ code: 0 });
  }

  if (amountValue <= 0) {
    console.error(`${LOG_PREFIX} Non-positive refund amount ${amountValue}`);
    return Response.json({ code: 0 });
  }

  try {
    const [intent] = await db
      .select()
      .from(paymentIntent)
      .where(eq(paymentIntent.externalTransactionId, paymentTransactionId))
      .limit(1);

    if (!intent) {
      console.error(
        `${LOG_PREFIX} No payment intent for payment ${paymentTransactionId} (refund ${refundTransactionId}). Manual reconciliation required.`
      );
      return Response.json({ code: 0 });
    }

    if (payload.AccountId && payload.AccountId !== intent.userId) {
      console.error(
        `${LOG_PREFIX} AccountId ${payload.AccountId} does not match intent owner ${intent.userId} for payment ${paymentTransactionId}. Manual reconciliation required.`
      );
      return Response.json({ code: 0 });
    }

    const minorUnits = await getMinorUnits(intent.currencyCode);
    const refundAmount = majorToMinorUnits(amountValue, minorUnits);

    const result = await applyPaymentRefund({
      intent,
      paymentTransactionId,
      refundTransactionId,
      refundAmount,
    });

    if (result.status === "currency_mismatch") {
      console.error(
        `${LOG_PREFIX} Payment currency ${intent.currencyCode} differs from balance currency ${result.balanceCurrencyCode} for user ${intent.userId}. Manual reconciliation required.`
      );
      return Response.json({ code: 0 });
    }

    if (result.status === "duplicate") {
      console.log(
        `${LOG_PREFIX} Refund ${refundTransactionId} already applied. Skipping balance debit.`
      );
    } else {
      console.log(
        `${LOG_PREFIX} Debited ${result.debitAmount} of ${refundAmount} (minor) from ${result.pool} pool of user ${intent.userId}; balances now subscription=${result.subscriptionBalanceAfter}, topup=${result.topupBalanceAfter}`
      );
    }

    // Runs on duplicates too, so a retry finishes a close that failed midway.
    if (intent.kind === "subscription" && result.isFullyRefunded) {
      await closeRefundedSubscription(intent);
    }

    return Response.json({ code: 0 });
  } catch (error) {
    console.error(
      `${LOG_PREFIX} Error processing refund ${refundTransactionId} of payment ${paymentTransactionId}:`,
      error
    );
    return Response.json({ code: 13 });
  }
}

/**
 * Stop the subscription a fully refunded payment belongs to: cancel the
 * CloudPayments recurrent (so it is never charged again) and end access now
 * rather than at period end. No-op when it is no longer active.
 */
async function closeRefundedSubscription(intent: PaymentIntent): Promise<void> {
  const subscriptionMatch = intent.externalSubscriptionId
    ? eq(userSubscription.externalSubscriptionId, intent.externalSubscriptionId)
    : intent.subscriptionId
      ? eq(userSubscription.subscriptionId, intent.subscriptionId)
      : undefined;

  if (!subscriptionMatch) {
    console.error(
      `${LOG_PREFIX} Payment intent ${intent.id} has no subscription reference; cancel the subscription of user ${intent.userId} manually.`
    );
    return;
  }

  const [activeSubscription] = await db
    .select()
    .from(userSubscription)
    .where(
      and(
        eq(userSubscription.userId, intent.userId),
        eq(userSubscription.status, "active"),
        subscriptionMatch
      )
    )
    .limit(1);

  if (!activeSubscription) {
    console.log(
      `${LOG_PREFIX} No active subscription to close for user ${intent.userId}`
    );
    return;
  }

  if (activeSubscription.externalSubscriptionId) {
    await cancelRecurrent(activeSubscription.externalSubscriptionId);
  }

  const now = new Date();

  await db
    .update(userSubscription)
    .set({
      status: "cancelled",
      cancelAtPeriodEnd: true,
      cancelledAt: now,
      currentPeriodEnd: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(userSubscription.id, activeSubscription.id),
        eq(userSubscription.status, "active")
      )
    );

  console.log(
    `${LOG_PREFIX} Subscription ${activeSubscription.id} of user ${intent.userId} cancelled after full refund`
  );
}

/**
 * Cancel the CloudPayments recurrent. Failure must not block the DB update, so
 * it is logged loudly for a manual cancel in the back office instead.
 */
async function cancelRecurrent(externalSubscriptionId: string): Promise<void> {
  try {
    const response = await cancelSubscription(externalSubscriptionId);

    if (!response.Success) {
      console.error(
        `${LOG_PREFIX} CloudPayments refused to cancel recurrent ${externalSubscriptionId}: ${response.Message}. Cancel it manually in the back office.`
      );
    }
  } catch (error) {
    console.error(
      `${LOG_PREFIX} Failed to cancel recurrent ${externalSubscriptionId}. Cancel it manually in the back office:`,
      error
    );
  }
}
