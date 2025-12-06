import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/queries";
import { userSubscription } from "@/lib/db/schema";
import type { CloudPaymentsRecurrentWebhook } from "@/lib/payments/cloudpayments-types";
import {
  calculateNextBillingDate,
  calculatePeriodEnd,
} from "@/lib/subscription/billing-periods";

export async function handleRecurrentWebhook(
  payload: CloudPaymentsRecurrentWebhook
): Promise<Response> {
  console.log("Recurrent webhook received:", JSON.stringify(payload, null, 2));
  const { AccountId, Amount, SuccessfulTransactionsNumber, Id } = payload;

  console.log(
    `[CloudPayments:Recurrent] Recurrent payment for user ${AccountId}, amount: ${Amount}, successful txs: ${SuccessfulTransactionsNumber}, subscription: ${Id}`
  );

  if (AccountId) {
    const subscriptions = await db
      .select()
      .from(userSubscription)
      .where(
        and(
          eq(userSubscription.userId, AccountId),
          eq(userSubscription.status, "active")
        )
      )
      .limit(1);

    if (subscriptions.length > 0) {
      const subscription = subscriptions[0];
      const now = new Date();
      const periodEnd = calculatePeriodEnd(
        now,
        subscription.billingPeriod,
        subscription.billingPeriodCount
      );
      const nextBilling = calculateNextBillingDate(
        now,
        subscription.billingPeriod,
        subscription.billingPeriodCount
      );

      await db
        .update(userSubscription)
        .set({
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          nextBillingDate: nextBilling,
          lastPaymentDate: now,
          lastPaymentAmount: Amount?.toString() ?? null,
        })
        .where(eq(userSubscription.id, subscription.id));
    }
  }

  return Response.json({ code: 0 });
}
