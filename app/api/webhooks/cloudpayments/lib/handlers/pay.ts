import { and, eq, ne } from "drizzle-orm";
import { ensureBalance, resetSubscriptionPool } from "@/lib/billing/balance";
import { majorToMinorUnits } from "@/lib/billing/money";
import {
  getSubscriptionByCode,
  priceForCurrency,
} from "@/lib/billing/subscriptions";
import { db } from "@/lib/db/connection";
import {
  paymentIntent,
  type Subscription,
  subscription,
  user,
  userSubscription,
} from "@/lib/db/schema";
import { createSubscription, voidPayment } from "@/lib/payments/cloudpayments";
import type { CloudPaymentsPayWebhook } from "@/lib/payments/cloudpayments-types";
import {
  calculateNextBillingDate,
  calculatePeriodEnd,
} from "@/lib/subscription/billing-periods";
import { parseWebhookData, toNumber } from "./utils";

const TRIAL_DAYS = 3;
const RUB_MINOR_UNITS = 2;

// The schema's payment-intent metadata column type is closed; widen it locally
// to carry the trial flag (the column accepts any structurally-compatible
// object).
type PaymentIntentMetadata = NonNullable<
  (typeof paymentIntent.$inferInsert)["metadata"]
> & {
  isTrial?: boolean;
};

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

  if (!isTrial && amountMinor !== price) {
    console.error(
      `[CloudPayments:Pay] Amount mismatch for plan ${planName}. Expected ${price}, Received ${amountMinor}`
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
      sub,
      currencyCode: balanceSummary.currencyCode,
      price,
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
          isTrial: false,
          trialEndsAt: null,
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

async function handleTrialPayment({
  accountId,
  email,
  token,
  transactionId,
  sub,
  currencyCode,
  price,
  sessionId,
  cardMask,
}: {
  accountId: string;
  email: string;
  token?: string;
  transactionId: number;
  sub: Subscription;
  currencyCode: string;
  price: number;
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
    if (sub.billingPeriod === "daily") {
      recurrentConfig = { interval: "Day", period: sub.billingPeriodCount };
    } else if (sub.billingPeriod === "annual") {
      recurrentConfig = {
        interval: "Month",
        period: 12 * sub.billingPeriodCount,
      };
    } else {
      recurrentConfig = { interval: "Month", period: sub.billingPeriodCount };
    }

    console.log(
      "[CloudPayments:Pay:Trial] Creating subscription with delayed start..."
    );
    // CloudPayments expects the recurring charge in MAJOR RUB units.
    const recurringAmountMajor = price / 10 ** RUB_MINOR_UNITS;
    const subscriptionResult = await createSubscription({
      token: token ?? "",
      email,
      accountId,
      description: sub.displayName ?? sub.code,
      amount: recurringAmountMajor,
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
      subscriptionId: sub.id,
      currencyCode,
      currentPeriodStart: now,
      currentPeriodEnd: trialEndsAt,
      nextBillingDate: trialEndsAt,
      status: "active",
      externalSubscriptionId,
      cardToken: token ?? null,
      cardMask,
      isTrial: true,
      trialEndsAt,
      cancelAtPeriodEnd: false,
      cancelledAt: null,
    });

    await db
      .update(user)
      .set({ trialUsedAt: now })
      .where(eq(user.id, accountId));

    // Trials grant NO balance until the first real (recurring) payment lands.

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
        const trialMetadata: PaymentIntentMetadata = {
          ...(intents[0].metadata ?? {}),
          subscriptionCode: sub.code,
          isTrial: true,
        };

        await db
          .update(paymentIntent)
          .set({
            status: "succeeded",
            kind: "subscription",
            subscriptionId: sub.id,
            currencyCode,
            externalSubscriptionId,
            externalTransactionId: transactionId.toString(),
            metadata: trialMetadata,
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
