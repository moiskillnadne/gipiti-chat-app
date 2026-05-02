"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "@/lib/i18n/translate";
import type { SubscriptionUiState } from "@/lib/subscription/subscription-state";
import styles from "./dashboard.module.css";
import { RefreshIcon } from "./icons";

export type PlanCardData = {
  displayName: string;
  periodLabel: string;
  formattedPrice: string;
  nextPaymentDate: string | null;
  lastPayment: string | null;
  cardMask: string | null;
  accessUntilDate: string | null;
  chargingStartDate: string | null;
  nextRetryDate: string | null;
  pastDueLastAmount: string | null;
};

type PlanCardProps = {
  state: SubscriptionUiState;
  data: PlanCardData;
  dimmed?: boolean;
};

const MANAGE_HREF = "/manage-subscription";

export function PlanCard({ state, data, dimmed = false }: PlanCardProps) {
  const router = useRouter();
  const t = useTranslations("auth.subscription.dashboard.plan");

  const cardClass = [styles.card, dimmed ? styles.cardDimmed : ""]
    .filter(Boolean)
    .join(" ");

  const goToManage = () => router.push(MANAGE_HREF);

  return (
    <section aria-label={t("title")} className={cardClass}>
      <div className={styles.cardHead}>
        <h3 className={styles.cardTitle}>{t("title")}</h3>
        {state === "trial" && (
          <span className={styles.cardBadge}>{t("badge.trial")}</span>
        )}
        {state === "cancelled" && (
          <span className={styles.cardBadge}>{t("badge.cancelled")}</span>
        )}
        {state === "past_due" && (
          <span className={`${styles.cardBadge} ${styles.cardBadgeWarn}`}>
            {t("badge.pastDue")}
          </span>
        )}
      </div>

      <div className={styles.planRow}>
        <span className={styles.planNm}>
          {data.displayName}
          <span className={styles.planNmEm}>{data.periodLabel}</span>
        </span>
        <span className={styles.planPr}>
          {t("priceLabel")}
          <b>{data.formattedPrice}</b>
        </span>
      </div>

      <div className={styles.planMeta}>
        <PlanMetaCell label={t("meta.period")} value={data.periodLabel} />

        {state === "trial" && (
          <PlanMetaCell
            label={t("meta.startCharging")}
            value={data.chargingStartDate ?? t("meta.notAvailable")}
          />
        )}
        {state === "cancelled" && (
          <PlanMetaCell
            label={t("meta.accessUntil")}
            value={data.accessUntilDate ?? t("meta.notAvailable")}
          />
        )}
        {state === "past_due" && (
          <PlanMetaCell
            label={t("meta.nextRetry")}
            value={data.nextRetryDate ?? t("meta.notAvailable")}
          />
        )}
        {(state === "active" || state === "none") && (
          <PlanMetaCell
            label={t("meta.nextPayment")}
            value={data.nextPaymentDate ?? t("meta.notAvailable")}
          />
        )}

        {state === "trial" ? (
          <PlanMetaCell
            label={t("meta.lastPayment")}
            value={t("meta.lastPaymentTrial")}
          />
        ) : state === "past_due" && data.pastDueLastAmount ? (
          <PlanMetaCell
            label={t("meta.lastPayment")}
            valueNode={
              <>
                <span className={styles.planMetaVStrike}>
                  {data.pastDueLastAmount}
                </span>
                {t("meta.lastPaymentRejected")}
              </>
            }
          />
        ) : (
          <PlanMetaCell
            label={t("meta.lastPayment")}
            value={data.lastPayment ?? t("meta.notAvailable")}
          />
        )}

        <PlanMetaCell
          label={t("meta.card")}
          value={data.cardMask ?? t("meta.notAvailable")}
        />
      </div>

      <PlanCardCta onAction={goToManage} state={state} />
    </section>
  );
}

type PlanMetaCellProps = {
  label: string;
  value?: string;
  valueNode?: React.ReactNode;
};

function PlanMetaCell({ label, value, valueNode }: PlanMetaCellProps) {
  return (
    <div>
      <div className={styles.planMetaK}>{label}</div>
      <div className={styles.planMetaV}>{valueNode ?? value}</div>
    </div>
  );
}

type PlanCardCtaProps = {
  state: SubscriptionUiState;
  onAction: () => void;
};

function PlanCardCta({ state, onAction }: PlanCardCtaProps) {
  const t = useTranslations("auth.subscription.dashboard.plan.cta");

  if (state === "trial") {
    return (
      <button
        className={`${styles.btn} ${styles.btnPrimary} ${styles.btnFull}`}
        onClick={onAction}
        type="button"
      >
        {t("upgrade")}
      </button>
    );
  }

  if (state === "cancelled") {
    return (
      <button
        className={`${styles.btn} ${styles.btnAccent} ${styles.btnFull}`}
        onClick={onAction}
        type="button"
      >
        <RefreshIcon />
        {t("resume")}
      </button>
    );
  }

  if (state === "past_due") {
    return (
      <button
        className={`${styles.btn} ${styles.btnDanger} ${styles.btnFull}`}
        onClick={onAction}
        type="button"
      >
        {t("updateCard")}
      </button>
    );
  }

  return (
    <button
      className={`${styles.btn} ${styles.btnPrimary} ${styles.btnFull}`}
      onClick={onAction}
      type="button"
    >
      {t("manage")}
    </button>
  );
}
