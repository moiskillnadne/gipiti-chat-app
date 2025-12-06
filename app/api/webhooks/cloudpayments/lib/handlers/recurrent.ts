import { eq } from "drizzle-orm";
import { db } from "@/lib/db/queries";
import { userSubscription } from "@/lib/db/schema";
import type { CloudPaymentsRecurrentWebhook } from "@/lib/payments/cloudpayments-types";
import {
  calculateNextBillingDate,
  calculatePeriodEnd,
} from "@/lib/subscription/billing-periods";

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isNaN(value) ? null : value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
};

const findSubscription = async (accountId: string, externalId: string) => {
  const byExternal = await db
    .select()
    .from(userSubscription)
    .where(eq(userSubscription.externalSubscriptionId, externalId))
    .limit(1);

  if (byExternal.length > 0) {
    return byExternal[0];
  }

  const byAccount = await db
    .select()
    .from(userSubscription)
    .where(eq(userSubscription.userId, accountId))
    .limit(1);

  return byAccount.length > 0 ? byAccount[0] : null;
};

export async function handleRecurrentWebhook(
  payload: CloudPaymentsRecurrentWebhook
): Promise<Response> {
  const { AccountId, Amount, Id, Status } = payload;

  if (!AccountId) {
    console.error("[CloudPayments:Recurrent] Missing AccountId");
    return Response.json({ code: 13 });
  }

  const subscription = await findSubscription(AccountId, Id);

  if (!subscription) {
    console.error(
      `[CloudPayments:Recurrent] Subscription not found: ${Id}, AccountId: ${AccountId}`
    );
    return Response.json({ code: 0 });
  }

  const now = new Date();
  const paymentAmount = toNumber(Amount);

  if (Status === "Active") {
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
        status: "active",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        nextBillingDate: nextBilling,
        lastPaymentDate: now,
        lastPaymentAmount:
          paymentAmount !== null ? paymentAmount.toString() : null,
        updatedAt: now,
      })
      .where(eq(userSubscription.id, subscription.id));

    return Response.json({ code: 0 });
  }

  if (Status === "PastDue") {
    await db
      .update(userSubscription)
      .set({
        status: "past_due",
        updatedAt: now,
      })
      .where(eq(userSubscription.id, subscription.id));

    return Response.json({ code: 0 });
  }

  if (Status === "Cancelled") {
    await db
      .update(userSubscription)
      .set({
        // Keep access for the already-paid period but prevent further renewals.
        status: "active",
        cancelAtPeriodEnd: true,
        cancelledAt: subscription.cancelledAt ?? now,
        updatedAt: now,
      })
      .where(eq(userSubscription.id, subscription.id));

    return Response.json({ code: 0 });
  }

  if (Status === "Rejected" || Status === "Expired") {
    await db
      .update(userSubscription)
      .set({
        // Disable access immediately for hard failures.
        status: "cancelled",
        cancelledAt: subscription.cancelledAt ?? now,
        updatedAt: now,
      })
      .where(eq(userSubscription.id, subscription.id));

    return Response.json({ code: 0 });
  }

  return Response.json({ code: 0 });
}
