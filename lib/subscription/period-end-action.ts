/**
 * What the period-end cron does with an active subscription whose period ended:
 * - `skip`: CloudPayments renews it (it has a CloudPayments subscription id);
 *   the CloudPayments webhooks extend the period after a successful charge.
 * - `renew`: extend the period without a charge. Only internal test accounts.
 * - `expire`: no payment backs a new period, so the subscription ends.
 */
export type PeriodEndAction = "skip" | "renew" | "expire";

export type PeriodEndCandidate = {
  externalSubscriptionId: string | null;
  isTester: boolean;
};

export const decidePeriodEndAction = ({
  externalSubscriptionId,
  isTester,
}: PeriodEndCandidate): PeriodEndAction => {
  if (externalSubscriptionId) {
    return "skip";
  }

  return isTester ? "renew" : "expire";
};
