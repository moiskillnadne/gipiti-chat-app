"use client";

import { useTranslations } from "@/lib/i18n/translate";
import dash from "./dashboard.module.css";
import { InfoIcon } from "./icons";
import styles from "./top-up.module.css";
import type { UnconfirmedCause } from "./top-up-poll-outcome";
import { formatRubMajor } from "./use-topup-amount";

export type TopupUnconfirmedProps = {
  amountMajor: number;
  cause: UnconfirmedCause;
  isChecking: boolean;
  hasRechecked: boolean;
  onRecheck: () => void;
  onClose: () => void;
};

/**
 * The payment outcome is unknown: the money may already have been charged.
 * Never says the money was not charged and offers no «pay again» action.
 */
export function TopupUnconfirmed({
  amountMajor,
  cause,
  isChecking,
  hasRechecked,
  onRecheck,
  onClose,
}: TopupUnconfirmedProps) {
  const t = useTranslations("auth.subscription.balance.topup.unconfirmed");

  return (
    <div className={styles.result}>
      <div className={`${styles.orb} ${styles.orbWarn}`}>
        <InfoIcon />
      </div>
      <h4 className={styles.resultTitle}>{t("title")}</h4>
      <p className={styles.resultText}>
        {t(`body.${cause}`, { amount: formatRubMajor(amountMajor) })}
      </p>
      <p className={styles.resultText}>{t("advice")}</p>
      {hasRechecked && !isChecking && (
        <output className={styles.resultText}>{t("stillPending")}</output>
      )}
      <div className={styles.resultActions}>
        <button
          className={`${dash.btn} ${dash.btnOutline} ${styles.resultActionPrimary}`}
          disabled={isChecking}
          onClick={onRecheck}
          type="button"
        >
          {isChecking ? t("checking") : t("recheck")}
        </button>
        <button
          className={`${dash.btn} ${dash.btnPrimary}`}
          onClick={onClose}
          type="button"
        >
          {t("close")}
        </button>
      </div>
    </div>
  );
}
