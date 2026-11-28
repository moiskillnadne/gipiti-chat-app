import { getBalance } from "@/server/modules/billing/balance";
import { priceForCurrency } from "@/server/modules/billing/subscriptions";
import {
  type BillingPeriodKey,
  getLatestSubscription,
} from "@/server/modules/subscription/get-latest-subscription";
import {
  deriveSubscriptionUiState,
  type SubscriptionUiState,
} from "@/server/modules/subscription/subscription-state";

export type SubscriptionSummary = {
  planCode: string;
  displayName: string | null;
  billingPeriod: BillingPeriodKey;
  /** The stored status of the row. */
  status: string;
  /** What the status and the dates mean for the user (see `subscription-state.ts`). */
  state: SubscriptionUiState;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  cancelledAt: Date | null;
  /** The currency of the amounts: the balance's, else the subscription's. */
  currencyCode: string;
  /** The plan's active price in `currencyCode`; null when it has none. */
  priceMinor: number | null;
  /** The next charge, or the next retry when `state` is `past_due`. */
  nextPayment: { date: Date; amountMinor: number | null } | null;
  cardMask: string | null;
};

type NextPayment = SubscriptionSummary["nextPayment"];

/**
 * The date and amount of the next charge, as the balance page shows them: none
 * for a cancelled or ended subscription, the retry date without an amount for
 * a past-due one, otherwise the next billing date (the period end as a
 * fallback) with the plan price.
 */
const resolveNextPayment = ({
  state,
  nextBillingDate,
  currentPeriodEnd,
  priceMinor,
}: {
  state: SubscriptionUiState;
  nextBillingDate: Date | null;
  currentPeriodEnd: Date;
  priceMinor: number | null;
}): NextPayment => {
  if (state === "cancelled" || state === "none") {
    return null;
  }
  if (state === "past_due") {
    return nextBillingDate
      ? { date: nextBillingDate, amountMinor: null }
      : null;
  }

  return {
    date: nextBillingDate ?? currentPeriodEnd,
    amountMinor: priceMinor,
  };
};

/**
 * The user's latest subscription as the balance and manage pages show it, or
 * null when the user never subscribed. An ended or expired row is returned
 * with `state: "none"`: whether the row is worth showing is the caller's call.
 */
export const getSubscriptionSummary = async ({
  userId,
  now = new Date(),
}: {
  userId: string;
  now?: Date;
}): Promise<SubscriptionSummary | null> => {
  const [latest, balance] = await Promise.all([
    getLatestSubscription(userId),
    getBalance(userId),
  ]);
  if (!latest) {
    return null;
  }

  const row = latest.subscription;
  const currencyCode = balance?.currencyCode ?? row.currencyCode;
  const state = deriveSubscriptionUiState({
    subscription: row,
    plan: null,
    now,
  });
  const priceMinor = await priceForCurrency(row.subscriptionId, currencyCode);

  return {
    planCode: latest.code,
    displayName: latest.displayName,
    billingPeriod: latest.billingPeriod,
    status: row.status,
    state,
    currentPeriodStart: row.currentPeriodStart,
    currentPeriodEnd: row.currentPeriodEnd,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
    cancelledAt: row.cancelledAt,
    currencyCode,
    priceMinor,
    nextPayment: resolveNextPayment({
      state,
      nextBillingDate: row.nextBillingDate,
      currentPeriodEnd: row.currentPeriodEnd,
      priceMinor,
    }),
    cardMask: row.cardMask,
  };
};
