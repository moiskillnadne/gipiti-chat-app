import Link from "next/link";
import { useTranslations } from "@/lib/i18n/translate";
import type { SubscriptionUiState } from "@/lib/subscription/subscription-state";
import styles from "./dashboard.module.css";

export type BalanceSummaryData = {
  currencyCode: string;
  subscriptionAmount: number;
  topupAmount: number;
  total: number;
  formattedTotal: string;
  formattedSubscription: string;
  formattedTopup: string;
};

type UsageGaugeCardProps = {
  state: SubscriptionUiState;
  dimmed?: boolean;
  balance?: BalanceSummaryData | null;
};

export function UsageGaugeCard({
  state,
  dimmed = false,
  balance = null,
}: UsageGaugeCardProps) {
  const t = useTranslations("auth.subscription.dashboard.gauge");
  const tHistory = useTranslations("auth.subscription.dashboard");

  const formattedTotal = balance?.formattedTotal ?? "—";
  const hasSplit =
    balance != null &&
    balance.subscriptionAmount > 0 &&
    balance.topupAmount > 0;

  const cardClass = [
    styles.card,
    styles.cardSpan2,
    dimmed ? styles.cardDimmed : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section aria-label={t("title")} className={cardClass}>
      <div className={styles.cardHead}>
        <h3 className={styles.cardTitle}>{t("title")}</h3>
        {state !== "none" && (
          <Link className={styles.cardLink} href="/subscription/usage">
            {tHistory("history")} →
          </Link>
        )}
      </div>
      <div className={styles.gaugeWrap}>
        <div className={styles.gaugeCenter}>
          <div className={styles.gaugePct}>{formattedTotal}</div>
          <div className={styles.gaugeCenterLbl}>{t("balanceLabel")}</div>
        </div>
        {hasSplit && balance && (
          <div className={styles.gaugeStats}>
            <div className={styles.gaugeStat}>
              <span className={styles.gaugeStatLbl}>{t("subscription")}</span>
              <span className={styles.gaugeStatVal}>
                {balance.formattedSubscription}
              </span>
            </div>
            <div className={styles.gaugeStat}>
              <span className={styles.gaugeStatLbl}>{t("topup")}</span>
              <span className={styles.gaugeStatVal}>
                {balance.formattedTopup}
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
