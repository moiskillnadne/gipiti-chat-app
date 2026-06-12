import { LOW_BALANCE_THRESHOLD_MINOR } from "@/lib/billing/constants";
import type { UserSubscription } from "@/lib/db/schema";

export type SubscriptionUiState = "active" | "cancelled" | "past_due" | "none";

const PAST_DUE_STATUSES = new Set(["past_due", "unpaid"]);
const TERMINAL_STATUSES = new Set([
  "cancelled",
  "canceled",
  "ended",
  "expired",
]);

export type SubscriptionStateInput = {
  subscription: UserSubscription | null;
  // Catalog metadata is optional; only the display name is consulted.
  plan?: { name?: string | null } | null;
  // Clock for period-end checks; injectable for tests.
  now?: Date;
};

function isFreeTierName(name: string | null | undefined): boolean {
  return name === "free";
}

export function deriveSubscriptionUiState({
  subscription,
  plan,
  now = new Date(),
}: SubscriptionStateInput): SubscriptionUiState {
  if (!subscription || isFreeTierName(plan?.name)) {
    return "none";
  }

  const status = subscription.status;

  // Terminal rows (cleanup cron ran, or the plan was replaced) mean the paid
  // period is over — the user is a regular free user.
  if (TERMINAL_STATUSES.has(status)) {
    return "none";
  }

  if (PAST_DUE_STATUSES.has(status)) {
    return "past_due";
  }

  if (subscription.cancelAtPeriodEnd) {
    // Access survives until the paid period ends; past that date the user is
    // free even if the cleanup cron has not flipped the status yet.
    const hasAccessLeft =
      subscription.currentPeriodEnd.getTime() > now.getTime();
    return hasAccessLeft ? "cancelled" : "none";
  }

  return "active";
}

/**
 * The 6 states the balance-first dashboard renders. Extends the 4 subscription
 * states with a low-balance warning and a free-tier split by remaining balance.
 */
export type BalanceViewState =
  | "active"
  | "low"
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
