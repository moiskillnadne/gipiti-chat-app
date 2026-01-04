import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/queries";
import {
  paymentIntent,
  subscriptionPlan,
  user,
  userSubscription,
} from "@/lib/db/schema";
import { createSubscription, voidPayment } from "@/lib/payments/cloudpayments";
import type { CloudPaymentsPayWebhook } from "@/lib/payments/cloudpayments-types";
import {
  calculateNextBillingDate,
  calculatePeriodEnd,
} from "@/lib/subscription/billing-periods";
import { SUBSCRIPTION_TIERS } from "@/lib/subscription/subscription-tiers";
import { parseWebhookData, toNumber } from "./utils";

const TRIAL_DAYS = 3;

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
    Email,
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

  const data = parseWebhookData<{
    planName?: string;
    sessionId?: string;
    isTrial?: boolean;
  }>(Data);

  if (data?.planName) {
    planName = data.planName;
  }

  if (data?.sessionId) {
    sessionId = data.sessionId;
  }

  const isTrial = data?.isTrial === true && amountValue === 1;

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

  if (!isTrial && amountValue !== tier.price.RUB) {
    console.error(
      `[CloudPayments:Pay] Amount mismatch for plan ${planName}. Expected ${tier.price.RUB}, Received ${amountValue}`
    );
    return Response.json({ code: 13 });
  }

  if (isTrial) {
    console.log("[CloudPayments:Pay] Processing trial payment");

    const users = await db
      .select()
      .from(user)
      .where(eq(user.id, AccountId))
      .limit(1);

    const userEmail = Email ?? users.at(0)?.email ?? "";

    return await handleTrialPayment({
      accountId: AccountId,
      email: userEmail,
      token: Token,
      transactionId: TransactionId,
      planName,
      tier,
      sessionId,
      cardMask: CardLastFour
        ? `${CardType ?? "Card"} ****${CardLastFour}`
        : null,
    });
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

async function handleTrialPayment({
  accountId,
  email,
  token,
  transactionId,
  planName,
  tier,
  sessionId,
  cardMask,
}: {
  accountId: string;
  email: string;
  token?: string;
  transactionId: number;
  planName: string;
  tier: (typeof SUBSCRIPTION_TIERS)[keyof typeof SUBSCRIPTION_TIERS];
  sessionId: string | null;
  cardMask: string | null;
}): Promise<Response> {
  try {
    console.log("[CloudPayments:Pay:Trial] Voiding 1 RUB hold...");
    const voidResult = await voidPayment({ transactionId });
    if (!voidResult.Success) {
      console.error(
        "[CloudPayments:Pay:Trial] Failed to void payment:",
        voidResult.Message
      );
    }

    const now = new Date();
    const trialEndsAt = new Date(
      now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000
    );

    let recurrentConfig: { interval: "Day" | "Month"; period: number };
    if (tier.billingPeriod === "daily") {
      recurrentConfig = { interval: "Day", period: tier.billingPeriodCount };
    } else if (tier.billingPeriod === "annual") {
      recurrentConfig = {
        interval: "Month",
        period: 12 * tier.billingPeriodCount,
      };
    } else {
      recurrentConfig = { interval: "Month", period: tier.billingPeriodCount };
    }

    console.log(
      "[CloudPayments:Pay:Trial] Creating subscription with delayed start..."
    );
    const subscriptionResult = await createSubscription({
      token: token ?? "",
      email,
      accountId,
      description: tier.displayName.en,
      amount: tier.price.RUB,
      currency: "RUB",
      interval: recurrentConfig.interval,
      period: recurrentConfig.period,
      startDate: trialEndsAt.toISOString(),
      requireConfirmation: false,
    });

    if (!subscriptionResult.Success) {
      console.error(
        "[CloudPayments:Pay:Trial] Failed to create subscription:",
        subscriptionResult.Message
      );
      return Response.json({ code: 13 });
    }

    const externalSubscriptionId = subscriptionResult.Model.Id;
    console.log(
      "[CloudPayments:Pay:Trial] Subscription created:",
      externalSubscriptionId
    );

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
    } // TODO: Check it later

    await db
      .update(userSubscription)
      .set({ status: "cancelled", cancelledAt: now })
      .where(
        and(
          eq(userSubscription.userId, accountId),
          eq(userSubscription.status, "active")
        )
      );

    await db.insert(userSubscription).values({
      userId: accountId,
      planId: plan.id,
      billingPeriod: tier.billingPeriod,
      billingPeriodCount: tier.billingPeriodCount,
      currentPeriodStart: now,
      currentPeriodEnd: trialEndsAt,
      nextBillingDate: trialEndsAt,
      status: "active",
      externalSubscriptionId,
      cardToken: token ?? null,
      cardMask,
      isTrial: true,
      trialEndsAt,
    });

    await db
      .update(user)
      .set({ currentPlan: planName, trialUsedAt: now })
      .where(eq(user.id, accountId));

    if (sessionId) {
      const intents = await db
        .select()
        .from(paymentIntent)
        .where(
          and(
            eq(paymentIntent.sessionId, sessionId),
            eq(paymentIntent.userId, accountId)
          )
        )
        .limit(1);

      if (intents.length > 0) {
        await db
          .update(paymentIntent)
          .set({
            status: "succeeded",
            externalSubscriptionId,
            externalTransactionId: transactionId.toString(),
            updatedAt: now,
          })
          .where(eq(paymentIntent.id, intents[0].id));
      }
    }

    console.log("[CloudPayments:Pay:Trial] Trial activated successfully");
    return Response.json({ code: 0 });
  } catch (error) {
    console.error("[CloudPayments:Pay:Trial] Error:", error);
    return Response.json({ code: 13 });
  }
}
