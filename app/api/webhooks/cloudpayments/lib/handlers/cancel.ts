import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/queries";
import { userSubscription } from "@/lib/db/schema";
import type { CloudPaymentsCancelWebhook } from "@/lib/payments/cloudpayments-types";

export async function handleCancelWebhook(
  payload: CloudPaymentsCancelWebhook
): Promise<Response> {
  const { AccountId, Id } = payload;

  console.log(
    `[CloudPayments:Cancel] Subscription cancelled for user ${AccountId}, subscription: ${Id}`
  );

  if (AccountId) {
    await db
      .update(userSubscription)
      .set({
        cancelAtPeriodEnd: true,
        cancelledAt: new Date(),
      })
      .where(
        and(
          eq(userSubscription.userId, AccountId),
          eq(userSubscription.status, "active")
        )
      );

    // Note: currentPlan will be set to null by cron job when period ends
    // User retains access until currentPeriodEnd
  }

  return Response.json({ code: 0 });
}
