import { LOW_BALANCE_THRESHOLD_MINOR } from "@/lib/billing/constants";
import type { UserSubscription } from "@/lib/db/schema";

export type SubscriptionUiState =
  | "active"
  | "trial"
  | "cancelled"
  | "past_due"
  | "none";

const TRIAL_LIKE_STATUSES = new Set(["active", "trialing", "trial"]);
const PAST_DUE_STATUSES = new Set(["past_due", "unpaid"]);
const CANCELLED_STATUSES = new Set(["cancelled", "canceled", "ended"]);

export type SubscriptionStateInput = {
  subscription: UserSubscription | null;
  // Catalog metadata is optional; only the display name is consulted.
  plan?: { name?: string | null } | null;
};

function isFreeTierName(name: string | null | undefined): boolean {
  return name === "free";
}

export function deriveSubscriptionUiState({
  subscription,
  plan,
}: SubscriptionStateInput): SubscriptionUiState {
  if (!subscription || isFreeTierName(plan?.name)) {
    return "none";
  }

  const status = subscription.status;
  const isTrialActive =
    subscription.isTrial &&
    (!subscription.trialEndsAt || subscription.trialEndsAt > new Date());

  if (isTrialActive && TRIAL_LIKE_STATUSES.has(status)) {
    return "trial";
  }

  if (PAST_DUE_STATUSES.has(status)) {
    return "past_due";
  }

  if (CANCELLED_STATUSES.has(status) || subscription.cancelAtPeriodEnd) {
    return "cancelled";
  }

  return "active";
}

/**
 * The 7 states the balance-first dashboard renders. Extends the 5 subscription
 * states with a low-balance warning and a free-tier split by remaining balance.
 */
export type BalanceViewState =
  | "active"
  | "low"
  | "trial"
  | "cancelled"
  | "past_due"
  | "free_with_balance"
  | "free_zero";

/**
 * Layer the user's balance on top of the subscription state. Free users (no
 * subscription) split by whether any spendable balance remains; active
 * subscribers below the low-balance threshold surface a warning state.
 */
export function deriveBalanceViewState({
  uiState,
  balanceTotal,
}: {
  uiState: SubscriptionUiState;
  balanceTotal: number;
}): BalanceViewState {
  if (uiState === "none") {
    return balanceTotal > 0 ? "free_with_balance" : "free_zero";
  }
  if (uiState === "active" && balanceTotal < LOW_BALANCE_THRESHOLD_MINOR) {
    return "low";
  }
  return uiState;
}
