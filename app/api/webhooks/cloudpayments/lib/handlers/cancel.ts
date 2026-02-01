import { eq } from "drizzle-orm";
import { db } from "@/lib/db/queries";
import { userSubscription } from "@/lib/db/schema";
import type { CloudPaymentsCancelWebhook } from "@/lib/payments/cloudpayments-types";

export async function handleCancelWebhook(
  payload: CloudPaymentsCancelWebhook
): Promise<Response> {
  const { AccountId, Id } = payload;

  console.log(
    `[CloudPayments:Cancel] Cancel webhook received. AccountId: ${AccountId}, SubscriptionId: ${Id}`
  );

  // CRITICAL: Only process if this is a SUBSCRIPTION cancellation (has Id)
  // Transaction cancellations (from voidPayment) don't have subscription Id
  if (!Id) {
    console.log(
      "[CloudPayments:Cancel] Ignoring - no subscription Id (likely a voided transaction)"
    );
    return Response.json({ code: 0 });
  }

  // Find subscription by external subscription ID for precise matching
  const subscriptions = await db
    .select()
    .from(userSubscription)
    .where(eq(userSubscription.externalSubscriptionId, Id))
    .limit(1);

  if (subscriptions.length === 0) {
    console.log(`[CloudPayments:Cancel] Subscription not found for Id: ${Id}`);
    return Response.json({ code: 0 });
  }

  const subscription = subscriptions[0];

  await db
    .update(userSubscription)
    .set({
      cancelAtPeriodEnd: true,
      cancelledAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(userSubscription.id, subscription.id));

  console.log(
    `[CloudPayments:Cancel] Subscription ${subscription.id} marked for cancellation`
  );

  // Note: currentPlan will be set to null by cron job when period ends
  // User retains access until currentPeriodEnd

  return Response.json({ code: 0 });
}
