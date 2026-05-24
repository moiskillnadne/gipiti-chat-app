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
