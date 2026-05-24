import { and, eq, inArray } from "drizzle-orm";
import { DEFAULT_CURRENCY_CODE } from "@/lib/billing/constants";
import { majorToMinorUnits } from "@/lib/billing/money";
import {
  getSubscriptionByCode,
  priceForCurrency,
} from "@/lib/billing/subscriptions";
import { db } from "@/lib/db/connection";
import { subscription, user, userSubscription } from "@/lib/db/schema";
import type { CloudPaymentsCheckWebhook } from "@/lib/payments/cloudpayments-types";
import { parseWebhookData } from "./utils";

const RECOVERABLE_STATUSES = ["active", "past_due"] as const;
const RUB_MINOR_UNITS = 2;

export async function handleCheckWebhook(
  payload: CloudPaymentsCheckWebhook
): Promise<Response> {
  const { AccountId, Amount, Data, Currency, SubscriptionId } = payload;

  console.info(
    `[CloudPayments:Check] Received webhook: AccountId=${AccountId}, Amount=${Amount}, Currency=${Currency}, SubscriptionId=${SubscriptionId}`
  );

  if (!AccountId) {
    console.error("[CloudPayments:Check] Missing AccountId");
    return Response.json({ code: 10 });
  }

  const users = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, AccountId))
    .limit(1);

  if (users.length === 0) {
    console.error(`[CloudPayments:Check] User not found: ${AccountId}`);
    return Response.json({ code: 10 });
  }

  let planName: string | null = null;
  const data = parseWebhookData<{ planName?: string; isTrial?: boolean }>(Data);
  if (data?.planName) {
    planName = data.planName;
  }

  const isTrial = data?.isTrial === true && Number(Amount) === 1;
  if (isTrial) {
    console.log("[CloudPayments:Check] Trial payment - 1 RUB verification");
    return Response.json({ code: 0 });
  }

  if (!planName) {
    console.log(
      "[CloudPayments:Check] planName not found in Data, looking up subscription from database"
    );

    // 1. Look up by externalSubscriptionId (most specific, no status filter needed)
    if (SubscriptionId) {
      const subscriptions = await db
        .select({
          code: subscription.code,
          status: userSubscription.status,
        })
        .from(userSubscription)
        .innerJoin(
          subscription,
          eq(userSubscription.subscriptionId, subscription.id)
        )
        .where(eq(userSubscription.externalSubscriptionId, SubscriptionId))
        .limit(1);

      if (subscriptions.length > 0) {
        planName = subscriptions[0].code;
        console.log(
          `[CloudPayments:Check] Found plan ${planName} (status: ${subscriptions[0].status}) by SubscriptionId ${SubscriptionId}`
        );
      } else {
        console.log(
          `[CloudPayments:Check] No subscription found by SubscriptionId ${SubscriptionId}`
        );
      }
    }

    // 2. Fallback: look up by userId with active or past_due status
    if (!planName) {
      const subscriptionsByUser = await db
        .select({
          code: subscription.code,
          status: userSubscription.status,
        })
        .from(userSubscription)
        .innerJoin(
          subscription,
          eq(userSubscription.subscriptionId, subscription.id)
        )
        .where(
          and(
            eq(userSubscription.userId, AccountId),
            inArray(userSubscription.status, [...RECOVERABLE_STATUSES])
          )
        )
        .limit(1);

      if (subscriptionsByUser.length > 0) {
        planName = subscriptionsByUser[0].code;
        console.log(
          `[CloudPayments:Check] Found plan ${planName} (status: ${subscriptionsByUser[0].status}) by AccountId ${AccountId}`
        );
      } else {
        console.log(
          `[CloudPayments:Check] No active/past_due subscription found for AccountId ${AccountId}`
        );
      }
    }
  }

  if (!planName) {
    console.error(
      `[CloudPayments:Check] Could not determine plan for user ${AccountId}`
    );
    return Response.json({ code: 13 });
  }

  const sub = await getSubscriptionByCode(planName);

  console.log("[CloudPayments:Check] Plan:", planName, "Subscription:", sub);

  if (!sub || !sub.isActive) {
    console.error(`[CloudPayments:Check] Invalid plan: ${planName}`);
    return Response.json({ code: 13 });
  }

  // Pricing is keyed in RUB; CloudPayments Amount arrives in MAJOR RUB units.
  const expectedAmount = await priceForCurrency(sub.id, DEFAULT_CURRENCY_CODE);
  if (expectedAmount == null) {
    console.error(
      `[CloudPayments:Check] No ${DEFAULT_CURRENCY_CODE} price for plan ${planName}`
    );
    return Response.json({ code: 13 });
  }

  const receivedMinor = majorToMinorUnits(Number(Amount), RUB_MINOR_UNITS);
  console.log(
    `[CloudPayments:Check] Expected Amount (minor): ${expectedAmount}. Received (minor): ${receivedMinor}`
  );

  if (receivedMinor !== expectedAmount) {
    console.error(
      `[CloudPayments:Check] Check: amount mismatch. Expected ${expectedAmount}, got ${receivedMinor}`
    );
    return Response.json({ code: 12 });
  }

  return Response.json({ code: 0 });
}
