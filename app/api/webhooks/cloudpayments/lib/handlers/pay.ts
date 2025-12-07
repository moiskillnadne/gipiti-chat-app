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
import { parseWebhookData, toNumber } from "./utils";

export async function handlePayWebhook(
  payload: CloudPaymentsPayWebhook
): Promise<Response> {
  const {
    AccountId,
    Token,
    SubscriptionId,
    Amount,
    Currency,
    Data,
    CardLastFour,
    CardType,
    TransactionId,
  } = payload;

  console.log(
    "[CloudPayments:Pay] Payload: ",
    JSON.stringify(payload, null, 2)
  );

  if (!AccountId) {
    console.error("[CloudPayments:Pay] Pay webhook missing AccountId");
    return Response.json({ code: 13 });
  }

  const normalizedCurrency = (Currency || "RUB").toUpperCase();
  const amountValue = toNumber(Amount);
  const transactionId =
    typeof TransactionId === "number" ? TransactionId.toString() : null;

  let planName: string | null = null;
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

  let existingSubscription: typeof userSubscription.$inferSelect | null = null;

  if (SubscriptionId) {
    const existing = await db
      .select()
      .from(userSubscription)
      .where(eq(userSubscription.externalSubscriptionId, SubscriptionId))
      .limit(1);

    if (existing.length > 0) {
      existingSubscription = existing[0];
    }
  }

  console.log(
    "[CloudPayments:Pay] User Subscription by External Subscription ID: ",
    JSON.stringify(existingSubscription, null, 2)
  );

  if (!planName && existingSubscription) {
    const existingPlans = await db
      .select()
      .from(subscriptionPlan)
      .where(eq(subscriptionPlan.id, existingSubscription.planId))
      .limit(1);

    planName = existingPlans[0]?.name ?? null;
  }

  if (!planName) {
    console.error("[CloudPayments:Pay] Missing planName in webhook data");
    return Response.json({ code: 13 });
  }

  console.log("[CloudPayments:Pay] Plan Name: ", planName);

  const tier = SUBSCRIPTION_TIERS[planName as keyof typeof SUBSCRIPTION_TIERS];

  if (!tier) {
    console.error(
      `[CloudPayments:Pay] Subscription tier not found: ${planName}`
    );
    return Response.json({ code: 13 });
  }

  const isFreeTesterPlan = tier.isTesterPlan && tier.price.RUB === 0;

  if (isFreeTesterPlan) {
    console.error(
      "[CloudPayments:Pay] Free tester plans are not allowed to be charged."
    );
    return Response.json({ code: 13 });
  }

  if (amountValue === null) {
    console.error(`[CloudPayments:Pay] Amount is not a number: ${Amount}`);
    return Response.json({ code: 13 });
  }

  if (normalizedCurrency !== "RUB") {
    console.error(
      `[CloudPayments:Pay] Currency is not RUB: ${normalizedCurrency}`
    );
    return Response.json({ code: 13 });
  }

  if (amountValue !== tier.price.RUB) {
    console.error(
      `[CloudPayments:Pay] Amount mismatch for plan ${planName}. Expected ${tier.price.RUB}, Received ${amountValue}`
    );
    return Response.json({ code: 13 });
  }

  try {
    const existingTransactionIntent =
      transactionId === null
        ? []
        : await db
            .select()
            .from(paymentIntent)
            .where(eq(paymentIntent.externalTransactionId, transactionId))
            .limit(1);

    const isTransactionAlreadySucceeded =
      existingTransactionIntent.length > 0 &&
      existingTransactionIntent[0].status === "succeeded";

    if (isTransactionAlreadySucceeded) {
      console.log(
        `[CloudPayments:Pay] Transaction ${transactionId} was already marked succeeded. Skipping.`
      );
      return Response.json({ code: 0 });
    }

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

    console.log("[CloudPayments:Pay] Plan: ", JSON.stringify(plan, null, 2));

    // Ensure a SubscriptionPlan row exists: use the fetched plan if present, otherwise create one from the tier config
    // (e.g., first time this plan processes a payment, the DB has no row yet, so we insert it and use that record).
    if (!plan) {
      console.log(
        "[CloudPayments:Pay] Plan not found, creating new plan based on tier:",
        JSON.stringify(tier, null, 2)
      );
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

    const cardMask = CardLastFour
      ? `${CardType ?? "Card"} ****${CardLastFour}`
      : null;

    const now = new Date();

    if (existingSubscription) {
      // If the user already has an active subscription, update the existing subscription.
      const periodStart =
        existingSubscription.currentPeriodEnd > now
          ? existingSubscription.currentPeriodEnd
          : now;

      const periodEnd = calculatePeriodEnd(
        periodStart,
        tier.billingPeriod,
        tier.billingPeriodCount
      );

      const nextBilling = calculateNextBillingDate(
        periodStart,
        tier.billingPeriod,
        tier.billingPeriodCount
      );

      await db
        .update(userSubscription)
        .set({
          planId: plan.id,
          billingPeriod: tier.billingPeriod,
          billingPeriodCount: tier.billingPeriodCount,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          nextBillingDate: nextBilling,
          status: "active",
          cancelAtPeriodEnd: false,
          cancelledAt: null,
          cardToken: Token ?? existingSubscription.cardToken,
          cardMask: cardMask ?? existingSubscription.cardMask,
          lastPaymentDate: now,
          lastPaymentAmount: amountValue.toFixed(2),
          updatedAt: now,
        })
        .where(eq(userSubscription.id, existingSubscription.id));
    } else {
      // If the user does not have an active subscription, cancel the existing subscription and create a new one.
      await db
        .update(userSubscription)
        .set({
          status: "cancelled",
          cancelledAt: now,
        })
        .where(
          and(
            eq(userSubscription.userId, AccountId),
            eq(userSubscription.status, "active")
          )
        );

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
        lastPaymentAmount: amountValue.toFixed(2),
      });
    }

    await db
      .update(user)
      .set({ currentPlan: planName })
      .where(eq(user.id, AccountId));

    const amountString = amountValue.toFixed(2);

    const upsertPaymentIntent = async (session: string) => {
      const intents = await db
        .select()
        .from(paymentIntent)
        .where(
          and(
            eq(paymentIntent.sessionId, session),
            eq(paymentIntent.userId, AccountId)
          )
        )
        .limit(1);

      if (intents.length > 0) {
        await db
          .update(paymentIntent)
          .set({
            status: "succeeded",
            externalSubscriptionId:
              SubscriptionId ?? intents[0].externalSubscriptionId,
            externalTransactionId:
              transactionId ?? intents[0].externalTransactionId,
            amount: amountString,
            currency: normalizedCurrency,
            updatedAt: now,
          })
          .where(eq(paymentIntent.id, intents[0].id));

        return;
      }

      await db.insert(paymentIntent).values({
        sessionId: session,
        userId: AccountId,
        planName,
        amount: amountString,
        currency: normalizedCurrency,
        status: "succeeded",
        externalSubscriptionId: SubscriptionId ?? null,
        externalTransactionId: transactionId,
        expiresAt: now,
        metadata: {
          planDisplayName: tier.displayName.en,
          billingPeriod: `${tier.billingPeriodCount} ${tier.billingPeriod}`,
        },
      });
    };

    if (existingTransactionIntent.length > 0) {
      await db
        .update(paymentIntent)
        .set({
          status: "succeeded",
          externalSubscriptionId:
            SubscriptionId ??
            existingTransactionIntent[0].externalSubscriptionId,
          externalTransactionId:
            transactionId ?? existingTransactionIntent[0].externalTransactionId,
          amount: amountString,
          currency: normalizedCurrency,
          updatedAt: now,
        })
        .where(eq(paymentIntent.id, existingTransactionIntent[0].id));
    } else if (sessionId) {
      await upsertPaymentIntent(sessionId);
    } else if (transactionId) {
      await upsertPaymentIntent(`cp_txn_${transactionId}`);
    }

    return Response.json({ code: 0 });
  } catch (error) {
    console.error("[CloudPayments:Pay] Error processing pay webhook:", error);
    return Response.json({ code: 13 });
  }
}
