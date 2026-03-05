import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/queries";
import { subscriptionPlan, user, userSubscription } from "@/lib/db/schema";
import type { CloudPaymentsCheckWebhook } from "@/lib/payments/cloudpayments-types";
import { SUBSCRIPTION_TIERS } from "@/lib/subscription/subscription-tiers";
import { parseWebhookData } from "./utils";

const RECOVERABLE_STATUSES = ["active", "past_due"] as const;

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
          planName: subscriptionPlan.name,
          status: userSubscription.status,
        })
        .from(userSubscription)
        .innerJoin(
          subscriptionPlan,
          eq(userSubscription.planId, subscriptionPlan.id)
        )
        .where(eq(userSubscription.externalSubscriptionId, SubscriptionId))
        .limit(1);

      if (subscriptions.length > 0) {
        planName = subscriptions[0].planName;
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
          planName: subscriptionPlan.name,
          status: userSubscription.status,
        })
        .from(userSubscription)
        .innerJoin(
          subscriptionPlan,
          eq(userSubscription.planId, subscriptionPlan.id)
        )
        .where(
          and(
            eq(userSubscription.userId, AccountId),
            inArray(userSubscription.status, [...RECOVERABLE_STATUSES])
          )
        )
        .limit(1);

      if (subscriptionsByUser.length > 0) {
        planName = subscriptionsByUser[0].planName;
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

  const tier = SUBSCRIPTION_TIERS[planName as keyof typeof SUBSCRIPTION_TIERS];

  console.log("[CloudPayments:Check] Plan:", planName, "Tier:", tier);

  if (!tier) {
    console.error(`[CloudPayments:Check] Invalid plan: ${planName}`);
    return Response.json({ code: 13 });
  }

  if (tier.isTesterPlan && tier.price.RUB === 0) {
    console.error(
      "[CloudPayments:Check] Free tester plans are not allowed to be charged."
    );
    return Response.json({ code: 13 });
  }

  const expectedAmount = Currency === "RUB" ? tier.price.RUB : tier.price.USD;
  console.log(
    `[CloudPayments:Check] Expected Amount: ${expectedAmount}. Received Amount: ${Amount}`
  );
  if (Number(Amount) !== expectedAmount) {
    console.error(
      `[CloudPayments:Check] Check: amount mismatch. Expected ${expectedAmount}, got ${Amount}`
    );
    return Response.json({ code: 12 });
  }

  return Response.json({ code: 0 });
}
