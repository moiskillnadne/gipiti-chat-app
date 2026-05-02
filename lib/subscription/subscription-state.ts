import type { SubscriptionPlan, UserSubscription } from "@/lib/db/schema";
import { SUBSCRIPTION_TIERS } from "./subscription-tiers";

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
  plan: SubscriptionPlan | null;
};

function isFreeTierName(name: string | null | undefined): boolean {
  if (!name) {
    return false;
  }
  const tier = SUBSCRIPTION_TIERS[name];
  return Boolean(tier?.isFreePlan);
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
