import { getTranslations } from "@/lib/i18n/translate";
import type { BalanceViewState } from "@/lib/subscription/subscription-state";
import styles from "./dashboard.module.css";

const PILL_VARIANT_CLASS: Record<BalanceViewState, string> = {
  active: styles.pillActive,
  low: styles.pillLow,
  cancelled: styles.pillCancelled,
  past_due: styles.pillPastDue,
  free_with_balance: styles.pillNone,
  free_zero: styles.pillPastDue,
};

const PILL_LABEL_KEY: Record<BalanceViewState, string> = {
  active: "active",
  low: "low",
  cancelled: "cancelled",
  past_due: "pastDue",
  free_with_balance: "none",
  free_zero: "freeZero",
};

type StatusPillProps = {
  state: BalanceViewState;
};

export async function StatusPill({ state }: StatusPillProps) {
  const t = await getTranslations("auth.subscription.balance.pill");
  return (
    <span className={`${styles.pill} ${PILL_VARIANT_CLASS[state]}`}>
      {t(PILL_LABEL_KEY[state])}
    </span>
  );
}
