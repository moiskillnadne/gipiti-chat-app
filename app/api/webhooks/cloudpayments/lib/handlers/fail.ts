import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/queries";
import { paymentIntent, userSubscription } from "@/lib/db/schema";
import type { CloudPaymentsFailWebhook } from "@/lib/payments/cloudpayments-types";
import { parseWebhookData } from "./utils";

export async function handleFailWebhook(
  payload: CloudPaymentsFailWebhook
): Promise<Response> {
  const { AccountId, Reason, ReasonCode, SubscriptionId, Data } = payload;

  console.error(
    `[CloudPayments:Fail] Payment failed for user ${AccountId}, reason: ${Reason} (code: ${ReasonCode}), subscription: ${SubscriptionId}`
  );

  let sessionId: string | null = null;
  const data = parseWebhookData<{ sessionId?: string }>(Data);
  if (data?.sessionId) {
    sessionId = data.sessionId;
  }

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
      await db
        .update(userSubscription)
        .set({ status: "past_due" })
        .where(eq(userSubscription.id, subscriptions[0].id));
    }

    if (sessionId) {
      const intents = await db
        .select()
        .from(paymentIntent)
        .where(
          and(
            eq(paymentIntent.sessionId, sessionId),
            eq(paymentIntent.userId, AccountId)
          )
        )
        .limit(1);

      if (intents.length > 0) {
        await db
          .update(paymentIntent)
          .set({
            status: "failed",
            failureReason: `${Reason} (code: ${ReasonCode})`,
            updatedAt: new Date(),
          })
          .where(eq(paymentIntent.id, intents[0].id));

        console.log(
          `[CloudPayments:Fail] Updated payment intent ${sessionId} to failed`
        );
      }
    }
  }

  return Response.json({ code: 0 });
}
