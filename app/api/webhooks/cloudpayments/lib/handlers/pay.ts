import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/queries";
import {
  paymentIntent,
  subscriptionPlan,
  user,
  userSubscription,
} from "@/lib/db/schema";
import type { CloudPaymentsPayWebhook } from "@/lib/payments/cloudpayments-types";
import {
  calculateNextBillingDate,
  calculatePeriodEnd,
} from "@/lib/subscription/billing-periods";
import { SUBSCRIPTION_TIERS } from "@/lib/subscription/subscription-tiers";
import { parseWebhookData } from "./utils";

export async function handlePayWebhook(
  payload: CloudPaymentsPayWebhook
): Promise<Response> {
  const {
    AccountId,
    Token,
    SubscriptionId,
    Amount,
    Data,
    CardLastFour,
    CardType,
  } = payload;

  if (!AccountId) {
    console.error("[CloudPayments:Pay] Pay webhook missing AccountId");
    return Response.json({ code: 13 });
  }

  let planName = "basic_monthly";
  let sessionId: string | null = null;
  const data = parseWebhookData<{ planName?: string; sessionId?: string }>(
    Data
  );
  if (data?.planName) {
    planName = data.planName;
  }
  if (data?.sessionId) {
    sessionId = data.sessionId;
  }

  const tier = SUBSCRIPTION_TIERS[planName as keyof typeof SUBSCRIPTION_TIERS];
  if (!tier || (tier.isTesterPlan && tier.price.RUB === 0)) {
    console.error(`[CloudPayments:Pay] Invalid plan: ${planName}`);
    return Response.json({ code: 13 });
  }

  if (SubscriptionId) {
    const existing = await db
      .select()
      .from(userSubscription)
      .where(eq(userSubscription.externalSubscriptionId, SubscriptionId))
      .limit(1);

    if (existing.length > 0) {
      console.log(
        `[CloudPayments:Pay] Subscription ${SubscriptionId} already processed, skipping`
      );
      return Response.json({ code: 0 });
    }
  }

  try {
    const users = await db
      .select()
      .from(user)
      .where(eq(user.id, AccountId))
      .limit(1);

    if (users.length === 0) {
      console.error(`[CloudPayments:Pay] User not found: ${AccountId}`);
      return Response.json({ code: 13 });
    }

    const plans = await db
      .select()
      .from(subscriptionPlan)
      .where(eq(subscriptionPlan.name, planName))
      .limit(1);

    let plan = plans[0];
    if (!plan) {
      const [newPlan] = await db
        .insert(subscriptionPlan)
        .values({
          name: tier.name,
          displayName: tier.displayName.en,
          billingPeriod: tier.billingPeriod,
          billingPeriodCount: tier.billingPeriodCount,
          tokenQuota: tier.tokenQuota,
          features: {
            maxMessagesPerPeriod: tier.features.maxMessagesPerPeriod,
            allowedModels: tier.features.allowedModels,
            hasReasoningModels: tier.features.hasReasoningModels,
            hasPrioritySupport: tier.features.hasPrioritySupport,
            maxFileSize: tier.features.maxFileSize,
            maxConcurrentChats: tier.features.maxConcurrentChats,
            hasAPIAccess: tier.features.hasAPIAccess,
          },
          price: tier.price.USD.toString(),
          isTesterPlan: tier.isTesterPlan ?? false,
        })
        .returning();
      plan = newPlan;
    }

    await db
      .update(userSubscription)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
      })
      .where(
        and(
          eq(userSubscription.userId, AccountId),
          eq(userSubscription.status, "active")
        )
      );

    const now = new Date();
    const periodEnd = calculatePeriodEnd(
      now,
      tier.billingPeriod,
      tier.billingPeriodCount
    );
    const nextBilling = calculateNextBillingDate(
      now,
      tier.billingPeriod,
      tier.billingPeriodCount
    );

    const cardMask = CardLastFour
      ? `${CardType ?? "Card"} ****${CardLastFour}`
      : null;

    await db.insert(userSubscription).values({
      userId: AccountId,
      planId: plan.id,
      billingPeriod: tier.billingPeriod,
      billingPeriodCount: tier.billingPeriodCount,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      nextBillingDate: nextBilling,
      status: "active",
      externalSubscriptionId: SubscriptionId ?? null,
      cardToken: Token ?? null,
      cardMask,
      lastPaymentDate: now,
      lastPaymentAmount: Amount?.toString() ?? null,
    });

    await db
      .update(user)
      .set({ currentPlan: planName })
      .where(eq(user.id, AccountId));

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
            status: "succeeded",
            externalSubscriptionId: SubscriptionId ?? null,
            updatedAt: new Date(),
          })
          .where(eq(paymentIntent.id, intents[0].id));

        console.log(
          `[CloudPayments:Pay] Updated payment intent ${sessionId} to succeeded`
        );
      } else {
        console.warn(
          `[CloudPayments:Pay] PaymentIntent not found for sessionId ${sessionId}`
        );
      }
    }

    console.log(
      `[CloudPayments:Pay] Subscription activated for user ${AccountId}, plan: ${planName}, card: ****${CardLastFour}`
    );

    return Response.json({ code: 0 });
  } catch (error) {
    console.error("[CloudPayments:Pay] Error processing pay webhook:", error);
    return Response.json({ code: 13 });
  }
}
