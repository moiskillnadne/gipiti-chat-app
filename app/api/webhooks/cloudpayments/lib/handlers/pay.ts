import { and, eq, ne } from "drizzle-orm";
import {
  creditTopupForIntent,
  ensureBalance,
  resetSubscriptionPool,
} from "@/lib/billing/balance";
import { majorToMinorUnits } from "@/lib/billing/money";
import {
  getSubscriptionByCode,
  priceForCurrency,
} from "@/lib/billing/subscriptions";
import { db } from "@/lib/db/connection";
import {
  type PaymentIntent,
  paymentIntent,
  type Subscription,
  subscription,
  user,
  userSubscription,
} from "@/lib/db/schema";
import type { CloudPaymentsPayWebhook } from "@/lib/payments/cloudpayments-types";
import {
  calculateNextBillingDate,
  calculatePeriodEnd,
} from "@/lib/subscription/billing-periods";
import {
  findTopupIntent,
  parseWebhookData,
  type TopupWebhookData,
  toNumber,
} from "./utils";

const RUB_MINOR_UNITS = 2;

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

  const data = parseWebhookData<TopupWebhookData>(Data);

  if (data?.planName) {
    planName = data.planName;
  }

  if (data?.sessionId) {
    sessionId = data.sessionId;
  }

  // One-time top-up: credit the persistent top-up pool and never touch the
  // subscription. Must run before any plan/subscription resolution.
  const topupIntent = sessionId
    ? await findTopupIntent(sessionId, AccountId)
    : null;

  if (data?.kind === "topup" || topupIntent !== null) {
    return handlePayTopup({
      intent: topupIntent,
      amountValue,
      normalizedCurrency,
      transactionId,
    });
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

  // Resolve the subscription code. The catalog Subscription is the source of
  // truth for period math and pricing.
  let sub: Subscription | null = null;

  if (planName) {
    sub = await getSubscriptionByCode(planName);
  }

  if (!sub && existingSubscription) {
    const [catalog] = await db
      .select()
      .from(subscription)
      .where(eq(subscription.id, existingSubscription.subscriptionId))
      .limit(1);

    if (catalog) {
      sub = catalog;
      planName = catalog.code;
    }
  }

  if (!(planName && sub)) {
    console.error(
      "[CloudPayments:Pay] Could not resolve subscription from webhook data"
    );
    return Response.json({ code: 13 });
  }

  console.log("[CloudPayments:Pay] Plan Name: ", planName);

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

  // The user's balance currency drives pricing; new users default to RUB.
  const balanceSummary = await ensureBalance(AccountId);
  const price = await priceForCurrency(sub.id, balanceSummary.currencyCode);

  if (price == null) {
    console.error(
      `[CloudPayments:Pay] No ${balanceSummary.currencyCode} price for subscription ${planName}`
    );
    return Response.json({ code: 13 });
  }

  // CloudPayments Amount arrives in MAJOR RUB units; compare against minor-unit
  // catalog price.
  const amountMinor = majorToMinorUnits(amountValue, RUB_MINOR_UNITS);

  if (amountMinor !== price) {
    console.error(
      `[CloudPayments:Pay] Amount mismatch for plan ${planName}. Expected ${price}, Received ${amountMinor}`
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

    const cardMask = CardLastFour
      ? `${CardType ?? "Card"} ****${CardLastFour}`
      : null;

    const now = new Date();

    if (existingSubscription) {
      // If the user already has an active subscription, update it in place.
      const periodStart =
        existingSubscription.currentPeriodEnd > now
          ? existingSubscription.currentPeriodEnd
          : now;

      const periodEnd = calculatePeriodEnd(
        periodStart,
        sub.billingPeriod,
        sub.billingPeriodCount
      );

      const nextBilling = calculateNextBillingDate(
        periodStart,
        sub.billingPeriod,
        sub.billingPeriodCount
      );

      await db
        .update(userSubscription)
        .set({
          subscriptionId: sub.id,
          currencyCode: balanceSummary.currencyCode,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          nextBillingDate: nextBilling,
          status: "active",
          cancelAtPeriodEnd: false,
          cancelledAt: null,
          cardToken: Token ?? existingSubscription.cardToken,
          cardMask: cardMask ?? existingSubscription.cardMask,
          lastPaymentDate: now,
          lastPaymentAmount: amountMinor,
          updatedAt: now,
        })
        .where(eq(userSubscription.id, existingSubscription.id));

      // Cancel any other active subscriptions for this user (orphaned subs)
      await db
        .update(userSubscription)
        .set({ status: "cancelled", cancelledAt: now })
        .where(
          and(
            eq(userSubscription.userId, AccountId),
            eq(userSubscription.status, "active"),
            ne(userSubscription.id, existingSubscription.id)
          )
        );
    } else {
      // No active subscription — cancel any leftover active rows and insert a new one.
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
        sub.billingPeriod,
        sub.billingPeriodCount
      );

      const nextBilling = calculateNextBillingDate(
        now,
        sub.billingPeriod,
        sub.billingPeriodCount
      );

      await db.insert(userSubscription).values({
        userId: AccountId,
        subscriptionId: sub.id,
        currencyCode: balanceSummary.currencyCode,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        nextBillingDate: nextBilling,
        status: "active",
        externalSubscriptionId: SubscriptionId ?? null,
        cardToken: Token ?? null,
        cardMask,
        lastPaymentDate: now,
        lastPaymentAmount: amountMinor,
        cancelAtPeriodEnd: false,
        cancelledAt: null,
      });
    }

    // Reset the subscription balance pool to the plan price on successful payment.
    try {
      await resetSubscriptionPool({
        userId: AccountId,
        amount: price,
        currencyCode: balanceSummary.currencyCode,
        type: "subscription_purchase",
        referenceId: transactionId ?? undefined,
        metadata: { subscriptionCode: planName, subscriptionId: sub.id },
      });
      console.log(
        `[CloudPayments:Pay] Subscription pool reset to ${price} for user ${AccountId}`
      );
    } catch (balanceError) {
      console.error(
        "[CloudPayments:Pay] Failed to reset subscription pool:",
        balanceError
      );
      // Continue processing - balance reset failure shouldn't block subscription
    }

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
            kind: "subscription",
            subscriptionId: sub.id,
            currencyCode: balanceSummary.currencyCode,
            amount: amountMinor,
            externalSubscriptionId:
              SubscriptionId ?? intents[0].externalSubscriptionId,
            externalTransactionId:
              transactionId ?? intents[0].externalTransactionId,
            updatedAt: now,
          })
          .where(eq(paymentIntent.id, intents[0].id));

        return;
      }

      await db.insert(paymentIntent).values({
        sessionId: session,
        userId: AccountId,
        kind: "subscription",
        subscriptionId: sub.id,
        currencyCode: balanceSummary.currencyCode,
        amount: amountMinor,
        status: "succeeded",
        externalSubscriptionId: SubscriptionId ?? null,
        externalTransactionId: transactionId,
        expiresAt: now,
        metadata: {
          subscriptionCode: planName,
          billingPeriod: `${sub.billingPeriodCount} ${sub.billingPeriod}`,
        },
      });
    };

    if (existingTransactionIntent.length > 0) {
      await db
        .update(paymentIntent)
        .set({
          status: "succeeded",
          kind: "subscription",
          subscriptionId: sub.id,
          currencyCode: balanceSummary.currencyCode,
          amount: amountMinor,
          externalSubscriptionId:
            SubscriptionId ??
            existingTransactionIntent[0].externalSubscriptionId,
          externalTransactionId:
            transactionId ?? existingTransactionIntent[0].externalTransactionId,
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

async function handlePayTopup({
  intent,
  amountValue,
  normalizedCurrency,
  transactionId,
}: {
  intent: PaymentIntent | null;
  amountValue: number | null;
  normalizedCurrency: string;
  transactionId: string | null;
}): Promise<Response> {
  if (!intent) {
    // Code 13 makes CloudPayments retry the notification — recovers from
    // transient DB lag; permanent mismatches surface in logs.
    console.error(
      "[CloudPayments:Pay][Topup] No top-up intent found for webhook session"
    );
    return Response.json({ code: 13 });
  }

  try {
    // Cheap idempotency pre-checks; the real race-proof guarantee is the
    // conditional claim inside creditTopupForIntent.
    if (transactionId !== null) {
      const [existing] = await db
        .select({ status: paymentIntent.status })
        .from(paymentIntent)
        .where(eq(paymentIntent.externalTransactionId, transactionId))
        .limit(1);

      if (existing?.status === "succeeded") {
        console.log(
          `[CloudPayments:Pay][Topup] Transaction ${transactionId} already succeeded. Skipping.`
        );
        return Response.json({ code: 0 });
      }
    }

    if (intent.status === "succeeded") {
      console.log(
        `[CloudPayments:Pay][Topup] Intent ${intent.sessionId} already succeeded. Skipping.`
      );
      return Response.json({ code: 0 });
    }

    if (normalizedCurrency !== "RUB") {
      console.error(
        `[CloudPayments:Pay][Topup] Currency is not RUB: ${normalizedCurrency}`
      );
      return Response.json({ code: 13 });
    }

    if (amountValue === null) {
      console.error("[CloudPayments:Pay][Topup] Amount is not a number");
      return Response.json({ code: 13 });
    }

    const amountMinor = majorToMinorUnits(amountValue, RUB_MINOR_UNITS);

    if (amountMinor !== intent.amount) {
      // Should be unreachable — the check webhook rejects mismatches before
      // money moves. Never credit an unvalidated amount; acknowledge with
      // code 0 to stop retry storms and reconcile manually from logs.
      console.error(
        `[CloudPayments:Pay][Topup] CRITICAL amount mismatch for intent ${intent.sessionId}. Expected ${intent.amount}, charged ${amountMinor}. Manual reconciliation required.`
      );
      await db
        .update(paymentIntent)
        .set({
          failureReason: `Amount mismatch: charged ${amountMinor}, expected ${intent.amount}`,
          updatedAt: new Date(),
        })
        .where(eq(paymentIntent.id, intent.id));
      return Response.json({ code: 0 });
    }

    const result = await creditTopupForIntent({
      intent,
      externalTransactionId: transactionId,
    });

    if (result === null) {
      console.log(
        `[CloudPayments:Pay][Topup] Intent ${intent.sessionId} was credited by a concurrent delivery. Skipping.`
      );
      return Response.json({ code: 0 });
    }

    console.log(
      `[CloudPayments:Pay][Topup] Credited ${result.amount} (minor) to user ${intent.userId}; top-up pool now ${result.topupBalanceAfter}`
    );
    return Response.json({ code: 0 });
  } catch (error) {
    console.error(
      "[CloudPayments:Pay][Topup] Error processing top-up webhook:",
      error
    );
    return Response.json({ code: 13 });
  }
}
