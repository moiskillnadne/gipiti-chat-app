import { eq } from "drizzle-orm";
import { resetBalance } from "@/lib/ai/token-balance";
import { db } from "@/lib/db/queries";
import { subscriptionPlan, userSubscription } from "@/lib/db/schema";
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

    const wasTrialConversion = subscription.isTrial;
    if (wasTrialConversion) {
      console.log(
        `[CloudPayments:Recurrent] Trial conversion for subscription ${subscription.id}`
      );
    }

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
        isTrial: false,
        trialEndsAt: null,
        updatedAt: now,
      })
      .where(eq(userSubscription.id, subscription.id));

    // Reset token balance to plan quota on successful recurring payment
    try {
      const plans = await db
        .select()
        .from(subscriptionPlan)
        .where(eq(subscriptionPlan.id, subscription.planId))
        .limit(1);

      const plan = plans[0];
      if (plan) {
        await resetBalance({
          userId: AccountId,
          newBalance: plan.tokenQuota,
          reason: "subscription_reset",
          referenceId: Id,
          planName: plan.name,
          subscriptionId: subscription.id,
        });
        console.log(
          `[CloudPayments:Recurrent] Token balance reset to ${plan.tokenQuota} for user ${AccountId}`
        );
      }
    } catch (balanceError) {
      console.error(
        "[CloudPayments:Recurrent] Failed to reset token balance:",
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
    console.warn(
      `[CloudPayments:Recurrent] Payment failed with status ${Status} for subscription ${subscription.id}, user ${AccountId}. Preserving access until period end.`
    );

    await db
      .update(userSubscription)
      .set({
        // Keep access until period end, then cleanup cron will finalize.
        // This handles both card failures AND infrastructure issues (SSL errors, etc.)
        status: "active",
        cancelAtPeriodEnd: true,
        cancelledAt: subscription.cancelledAt ?? now,
        updatedAt: now,
      })
      .where(eq(userSubscription.id, subscription.id));

    return Response.json({ code: 0 });
  }

  return Response.json({ code: 0 });
}
