import { getTranslations } from "@/lib/i18n/translate";
import type { BalanceViewState } from "@/lib/subscription/subscription-state";
import { formatBillingCycle, formatRuDate } from "@/lib/utils/format-billing";
import styles from "./dashboard.module.css";

const FREE_STATES = new Set<BalanceViewState>([
  "free_with_balance",
  "free_zero",
]);

type SubscriptionHeaderProps = {
  state: BalanceViewState;
  periodStart: Date | null;
  periodEnd: Date | null;
  pastDueRetryIn: string | null;
};

export async function SubscriptionHeader({
  state,
  periodStart,
  periodEnd,
  pastDueRetryIn,
}: SubscriptionHeaderProps) {
  const t = await getTranslations("auth.subscription.balance.header");
  const isFree = FREE_STATES.has(state);

  let cycleLabel: string | null = null;
  let cycleValue: string | null = null;

  if (state === "cancelled" && periodEnd) {
    cycleLabel = t("cycle.cancelled");
    cycleValue = formatRuDate(periodEnd);
  } else if (state === "past_due") {
    cycleLabel = t("cycle.pastDue");
    cycleValue = pastDueRetryIn ?? t("cycle.soon");
  } else if (
    (state === "active" || state === "low") &&
    periodStart &&
    periodEnd
  ) {
    cycleLabel = t("cycle.period");
    cycleValue = formatBillingCycle(periodStart, periodEnd);
  }

  return (
    <header className={styles.head}>
      <div>
        <h1 className={styles.headTitle}>
          {t("title")}
          <em>{isFree ? t("emFree") : t("emPaid")}</em>
        </h1>
        <p className={styles.headLede}>{t(`sub.${state}`)}</p>
      </div>
      {cycleLabel && cycleValue && (
        <div className={styles.cycle}>
          {cycleLabel}
          <b>{cycleValue}</b>
        </div>
      )}
    </header>
  );
}
