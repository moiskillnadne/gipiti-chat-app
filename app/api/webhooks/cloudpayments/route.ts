import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  calculateNextBillingDate,
  calculatePeriodEnd,
} from "@/lib/ai/billing-periods";
import { SUBSCRIPTION_TIERS } from "@/lib/ai/subscription-tiers";
import { db } from "@/lib/db/queries";
import { subscriptionPlan, user, userSubscription } from "@/lib/db/schema";
import { getCloudPaymentsConfig } from "@/lib/payments/cloudpayments-config";
import type {
  CloudPaymentsCancelWebhook,
  CloudPaymentsCheckWebhook,
  CloudPaymentsFailWebhook,
  CloudPaymentsPayWebhook,
  CloudPaymentsRecurrentWebhook,
} from "@/lib/payments/cloudpayments-types";

type WebhookType = "check" | "pay" | "fail" | "recurrent" | "cancel";

function validateWebhookSignature(
  body: string,
  signature: string | null
): boolean {
  if (!signature) {
    return false;
  }

  const config = getCloudPaymentsConfig();
  const hmac = crypto.createHmac("sha256", config.apiSecret);
  hmac.update(body);
  const expectedSignature = hmac.digest("base64");
  return signature === expectedSignature;
}

function getWebhookType(request: Request): WebhookType | null {
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  if (
    type === "check" ||
    type === "pay" ||
    type === "fail" ||
    type === "recurrent" ||
    type === "cancel"
  ) {
    return type;
  }
  return null;
}

async function handleCheckWebhook(
  payload: CloudPaymentsCheckWebhook
): Promise<Response> {
  const { AccountId, Amount, Data, Currency } = payload;

  console.log("[CloudPayments] Check webhook received", payload);

  if (!AccountId) {
    console.error("[CloudPayments] Check webhook missing AccountId");
    return Response.json({ code: 10 });
  }

  const users = await db
    .select()
    .from(user)
    .where(eq(user.id, AccountId))
    .limit(1);

  if (users.length === 0) {
    console.error(`[CloudPayments] Check: user not found: ${AccountId}`);
    return Response.json({ code: 10 });
  }

  let planName = "basic_monthly";
  if (Data) {
    try {
      const data = JSON.parse(Data);
      if (data.planName) {
        planName = data.planName;
      }
    } catch {
      // Ignore parse errors
    }
  }

  const tier = SUBSCRIPTION_TIERS[planName as keyof typeof SUBSCRIPTION_TIERS];

  console.log("[CloudPayments] Check Webhook - Tier:", tier);
  if (!tier || (tier.isTesterPlan && tier.price.RUB === 0)) {
    console.error(`[CloudPayments] Check: invalid plan: ${planName}`);
    return Response.json({ code: 13 });
  }

  const expectedAmount = Currency === "RUB" ? tier.price.RUB : tier.price.USD;
  console.log(
    "[CloudPayments] Check Webhook - Expected Amount:",
    expectedAmount
  );
  if (Amount !== expectedAmount) {
    console.error(
      `[CloudPayments] Check: amount mismatch. Expected ${expectedAmount}, got ${Amount}`
    );
    return Response.json({ code: 12 });
  }

  return Response.json({ code: 0 });
}

async function handlePayWebhook(
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
    console.error("[CloudPayments] Pay webhook missing AccountId");
    return Response.json({ code: 13 });
  }

  let planName = "basic_monthly";
  if (Data) {
    try {
      const data = JSON.parse(Data);
      if (data.planName) {
        planName = data.planName;
      }
    } catch {
      // Ignore parse errors
    }
  }

  const tier = SUBSCRIPTION_TIERS[planName as keyof typeof SUBSCRIPTION_TIERS];
  if (!tier || (tier.isTesterPlan && tier.price.RUB === 0)) {
    console.error(`[CloudPayments] Invalid plan: ${planName}`);
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
        `[CloudPayments] Subscription ${SubscriptionId} already processed, skipping`
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
      console.error(`[CloudPayments] User not found: ${AccountId}`);
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
    const periodEnd = calculatePeriodEnd(now, tier.billingPeriod);
    const nextBilling = calculateNextBillingDate(now, tier.billingPeriod);

    const cardMask = CardLastFour
      ? `${CardType ?? "Card"} ****${CardLastFour}`
      : null;

    await db.insert(userSubscription).values({
      userId: AccountId,
      planId: plan.id,
      billingPeriod: tier.billingPeriod,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      nextBillingDate: nextBilling,
      status: "active",
      externalSubscriptionId: SubscriptionId ?? null,
      externalCustomerId: Token ?? null,
      cardMask,
      lastPaymentDate: now,
      lastPaymentAmount: Amount?.toString() ?? null,
    });

    await db
      .update(user)
      .set({ currentPlan: planName })
      .where(eq(user.id, AccountId));

    console.log(
      `[CloudPayments] Subscription activated for user ${AccountId}, plan: ${planName}, card: ****${CardLastFour}`
    );

    return Response.json({ code: 0 });
  } catch (error) {
    console.error("[CloudPayments] Error processing pay webhook:", error);
    return Response.json({ code: 13 });
  }
}

async function handleFailWebhook(
  payload: CloudPaymentsFailWebhook
): Promise<Response> {
  const { AccountId, Reason, ReasonCode, SubscriptionId } = payload;

  console.error(
    `[CloudPayments] Payment failed for user ${AccountId}, reason: ${Reason} (code: ${ReasonCode}), subscription: ${SubscriptionId}`
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
      await db
        .update(userSubscription)
        .set({ status: "past_due" })
        .where(eq(userSubscription.id, subscriptions[0].id));
    }
  }

  return Response.json({ code: 0 });
}

async function handleRecurrentWebhook(
  payload: CloudPaymentsRecurrentWebhook
): Promise<Response> {
  const { AccountId, Amount, SuccessfulTransactionsNumber, Id } = payload;

  console.log(
    `[CloudPayments] Recurrent payment for user ${AccountId}, amount: ${Amount}, successful txs: ${SuccessfulTransactionsNumber}, subscription: ${Id}`
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
      const periodEnd = calculatePeriodEnd(now, subscription.billingPeriod);
      const nextBilling = calculateNextBillingDate(
        now,
        subscription.billingPeriod
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

async function handleCancelWebhook(
  payload: CloudPaymentsCancelWebhook
): Promise<Response> {
  const { AccountId, Id } = payload;

  console.log(
    `[CloudPayments] Subscription cancelled for user ${AccountId}, subscription: ${Id}`
  );

  if (AccountId) {
    await db
      .update(userSubscription)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
        cancelAtPeriodEnd: true,
      })
      .where(
        and(
          eq(userSubscription.userId, AccountId),
          eq(userSubscription.status, "active")
        )
      );

    await db
      .update(user)
      .set({ currentPlan: "tester" })
      .where(eq(user.id, AccountId));
  }

  return Response.json({ code: 0 });
}

export async function POST(request: Request): Promise<Response> {
  const webhookType = getWebhookType(request);

  if (!webhookType) {
    return Response.json(
      { error: "Missing or invalid webhook type" },
      { status: 400 }
    );
  }

  const rawBody = await request.text();
  const signature = request.headers.get("Content-HMAC");

  if (!validateWebhookSignature(rawBody, signature)) {
    console.error("[CloudPayments] Invalid webhook signature");
    return Response.json({ code: 13 }, { status: 401 });
  }

  let payload: unknown;
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const params = new URLSearchParams(rawBody);
      payload = Object.fromEntries(params.entries());
    } else {
      payload = JSON.parse(rawBody);
    }
  } catch (error) {
    console.error("[CloudPayments] Error parsing webhook payload:", error);
    return Response.json({ code: 13 });
  }

  switch (webhookType) {
    case "check":
      return await handleCheckWebhook(payload as CloudPaymentsCheckWebhook);
    case "pay":
      return handlePayWebhook(payload as CloudPaymentsPayWebhook);
    case "fail":
      return handleFailWebhook(payload as CloudPaymentsFailWebhook);
    case "recurrent":
      return handleRecurrentWebhook(payload as CloudPaymentsRecurrentWebhook);
    case "cancel":
      return handleCancelWebhook(payload as CloudPaymentsCancelWebhook);
    default:
      return Response.json({ code: 0 });
  }
}
