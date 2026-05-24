import { eq } from "drizzle-orm";
import { resetSubscriptionPool } from "@/lib/billing/balance";
import { priceForCurrency } from "@/lib/billing/subscriptions";
import { db } from "@/lib/db/connection";
import { subscription, userSubscription } from "@/lib/db/schema";
import type { CloudPaymentsRecurrentWebhook } from "@/lib/payments/cloudpayments-types";
import {
  calculateNextBillingDate,
  calculatePeriodEnd,
} from "@/lib/subscription/billing-periods";
import { toNumber } from "./utils";

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

  const userSub = await findSubscription(AccountId, Id);

  if (!userSub) {
    console.error(
      `[CloudPayments:Recurrent] Subscription not found: ${Id}, AccountId: ${AccountId}`
    );
    return Response.json({ code: 0 });
  }

  const now = new Date();
  const paymentAmount = toNumber(Amount);

  if (Status === "Active") {
    // Pull the catalog subscription for period math + pricing.
    const [catalog] = await db
      .select()
      .from(subscription)
      .where(eq(subscription.id, userSub.subscriptionId))
      .limit(1);

    if (!catalog) {
      console.error(
        `[CloudPayments:Recurrent] Catalog subscription ${userSub.subscriptionId} not found`
      );
      return Response.json({ code: 0 });
    }

    const periodEnd = calculatePeriodEnd(
      now,
      catalog.billingPeriod,
      catalog.billingPeriodCount
    );
    const nextBilling = calculateNextBillingDate(
      now,
      catalog.billingPeriod,
      catalog.billingPeriodCount
    );

    const wasTrialConversion = userSub.isTrial;
    if (wasTrialConversion) {
      console.log(
        `[CloudPayments:Recurrent] Trial conversion for subscription ${userSub.id}`
      );
    }

    // CloudPayments Amount is in MAJOR RUB units; store last payment in minor units.
    const lastPaymentMinor =
      paymentAmount !== null ? Math.round(paymentAmount * 100) : null;

    await db
      .update(userSubscription)
      .set({
        status: "active",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        nextBillingDate: nextBilling,
        lastPaymentDate: now,
        lastPaymentAmount: lastPaymentMinor,
        isTrial: false,
        trialEndsAt: null,
        updatedAt: now,
      })
      .where(eq(userSubscription.id, userSub.id));

    // Reset the subscription balance pool to the plan price on successful renewal.
    try {
      const price = await priceForCurrency(
        userSub.subscriptionId,
        userSub.currencyCode
      );

      if (price == null) {
        console.error(
          `[CloudPayments:Recurrent] No ${userSub.currencyCode} price for subscription ${userSub.subscriptionId}`
        );
      } else {
        await resetSubscriptionPool({
          userId: AccountId,
          amount: price,
          currencyCode: userSub.currencyCode,
          type: "subscription_renewal",
          referenceId: Id,
          metadata: {
            subscriptionCode: catalog.code,
            subscriptionId: catalog.id,
          },
        });
        console.log(
          `[CloudPayments:Recurrent] Subscription pool reset to ${price} for user ${AccountId}`
        );
      }
    } catch (balanceError) {
      console.error(
        "[CloudPayments:Recurrent] Failed to reset subscription pool:",
        balanceError
      );
      // Continue - balance reset failure shouldn't cause webhook to fail
    }

    return Response.json({ code: 0 });
  }

  if (Status === "PastDue") {
    await db
      .update(userSubscription)
      .set({
        status: "past_due",
        updatedAt: now,
      })
      .where(eq(userSubscription.id, userSub.id));

    return Response.json({ code: 0 });
  }

  if (Status === "Cancelled") {
    await db
      .update(userSubscription)
      .set({
        // Keep access for the already-paid period but prevent further renewals.
        status: "active",
        cancelAtPeriodEnd: true,
        cancelledAt: userSub.cancelledAt ?? now,
        updatedAt: now,
      })
      .where(eq(userSubscription.id, userSub.id));

    return Response.json({ code: 0 });
  }

  if (Status === "Rejected") {
    console.warn(
      `[CloudPayments:Recurrent] Payment rejected for subscription ${userSub.id}, user ${AccountId}. Setting past_due to allow retry.`
    );

    await db
      .update(userSubscription)
      .set({
        // Mark as past_due so the user keeps access and CloudPayments can retry.
        // Do NOT set cancelAtPeriodEnd — a single rejection shouldn't auto-cancel.
        status: "past_due",
        updatedAt: now,
      })
      .where(eq(userSubscription.id, userSub.id));

    return Response.json({ code: 0 });
  }

  if (Status === "Expired") {
    console.warn(
      `[CloudPayments:Recurrent] Subscription expired for ${userSub.id}, user ${AccountId}. Preserving access until period end.`
    );

    await db
      .update(userSubscription)
      .set({
        // Expired means CloudPayments won't retry — schedule cancellation at period end.
        status: "active",
        cancelAtPeriodEnd: true,
        cancelledAt: userSub.cancelledAt ?? now,
        updatedAt: now,
      })
      .where(eq(userSubscription.id, userSub.id));

    return Response.json({ code: 0 });
  }

  return Response.json({ code: 0 });
}
