import { getTranslations } from "@/lib/i18n/translate";
import type { SubscriptionUiState } from "@/lib/subscription/subscription-state";
import styles from "./dashboard.module.css";

const PILL_VARIANT_CLASS: Record<SubscriptionUiState, string> = {
  active: styles.pillActive,
  trial: styles.pillTrial,
  cancelled: styles.pillCancelled,
  past_due: styles.pillPastDue,
  none: styles.pillNone,
};

const PILL_LABEL_KEY: Record<SubscriptionUiState, string> = {
  active: "active",
  trial: "trial",
  cancelled: "cancelled",
  past_due: "pastDue",
  none: "none",
};

type StatusPillProps = {
  state: SubscriptionUiState;
};

export async function StatusPill({ state }: StatusPillProps) {
  const t = await getTranslations("auth.subscription.dashboard.pill");
  return (
    <span className={`${styles.pill} ${PILL_VARIANT_CLASS[state]}`}>
      {t(PILL_LABEL_KEY[state])}
    </span>
  );
}
