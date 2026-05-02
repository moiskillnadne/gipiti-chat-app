import { getTranslations } from "@/lib/i18n/translate";
import type { SubscriptionUiState } from "@/lib/subscription/subscription-state";
import {
  formatBillingCycle,
  formatRuDate,
  pluralRu,
} from "@/lib/utils/format-billing";
import styles from "./dashboard.module.css";

type SubscriptionHeaderProps = {
  state: SubscriptionUiState;
  periodStart: Date | null;
  periodEnd: Date | null;
  trialDaysLeft: number;
};

const DAY_FORMS = ["день", "дня", "дней"] as const;

export async function SubscriptionHeader({
  state,
  periodStart,
  periodEnd,
  trialDaysLeft,
}: SubscriptionHeaderProps) {
  const t = await getTranslations("auth.subscription.dashboard");
  const showCycle = state !== "none";
  const titleSuffix =
    state === "none" ? t("titleSuffix.plans") : t("titleSuffix.overview");
  const lede = state === "none" ? t("lede.plans") : t("lede.overview");

  let cycleLabel: string | null = null;
  let cycleValue: string | null = null;

  if (state === "trial") {
    cycleLabel = t("cycle.trialLabel");
    cycleValue = t("cycle.trialDaysValue", {
      days: trialDaysLeft,
      dayWord: pluralRu(trialDaysLeft, DAY_FORMS),
    });
  } else if (state === "cancelled" && periodEnd) {
    cycleLabel = t("cycle.cancelledLabel");
    cycleValue = formatRuDate(periodEnd);
  } else if (periodStart && periodEnd) {
    cycleLabel = t("cycle.label");
    cycleValue = formatBillingCycle(periodStart, periodEnd);
  }

  return (
    <header className={styles.head}>
      <div>
        <h1 className={styles.headTitle}>
          {t("title")}
          <em>{titleSuffix}</em>
        </h1>
        <p className={styles.headLede}>{lede}</p>
      </div>
      {showCycle && cycleLabel && cycleValue && (
        <div className={styles.cycle}>
          {cycleLabel}
          <b>{cycleValue}</b>
        </div>
      )}
    </header>
  );
}
