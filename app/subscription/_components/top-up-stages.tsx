"use client";

import {
  TOPUP_MAX_MAJOR_UNITS,
  TOPUP_MIN_MAJOR_UNITS,
  TOPUP_PRESETS_MAJOR_UNITS,
} from "@/lib/billing/constants";
import { formatCurrency } from "@/lib/billing/money";
import { useTranslations } from "@/lib/i18n/translate";
import dash from "./dashboard.module.css";
import { CheckIcon, InfinityIcon, WarnIcon, XIcon } from "./icons";
import styles from "./top-up.module.css";
import { formatRubMajor, type TopupAmount } from "./use-topup-amount";

const RUB_MINOR_UNITS = 2;

type TopupHeadProps = {
  onClose: () => void;
};

function TopupHead({ onClose }: TopupHeadProps) {
  const t = useTranslations("auth.subscription.balance.topup");

  return (
    <div className={styles.head}>
      <h3 className={styles.title}>{t("title")}</h3>
      <button
        aria-label={t("closeAria")}
        className={styles.close}
        onClick={onClose}
        type="button"
      >
        <XIcon height={14} width={14} />
      </button>
    </div>
  );
}

export type TopupAmountStageProps = {
  amount: TopupAmount;
  isSubmitting: boolean;
  submitError: string | null;
  onSubmit: () => void;
  onClose: () => void;
};

export function TopupAmountStage({
  amount,
  isSubmitting,
  submitError,
  onSubmit,
  onClose,
}: TopupAmountStageProps) {
  const t = useTranslations("auth.subscription.balance.topup");

  const errorMessage =
    amount.error === "min"
      ? t("errorMin", { amount: formatRubMajor(TOPUP_MIN_MAJOR_UNITS) })
      : amount.error === "max"
        ? t("errorMax", { amount: formatRubMajor(TOPUP_MAX_MAJOR_UNITS) })
        : null;

  return (
    <>
      <TopupHead onClose={onClose} />

      <div className={styles.chips}>
        {TOPUP_PRESETS_MAJOR_UNITS.map((preset) => (
          <button
            className={`${styles.chip} ${
              amount.value === preset ? styles.chipSelected : ""
            }`}
            key={preset}
            onClick={() => amount.set(preset)}
            type="button"
          >
            {formatRubMajor(preset)}
          </button>
        ))}
      </div>

      <div>
        <div className={styles.lbl}>{t("customAmountLabel")}</div>
        <div
          className={`${styles.inputWrap} ${
            amount.error ? styles.inputWrapErr : ""
          }`}
        >
          <input
            inputMode="numeric"
            onChange={(event) => amount.set(event.target.value)}
            placeholder={t("amountPlaceholder")}
            type="text"
            value={amount.display}
          />
          <span className={styles.cur}>
            {t("amountHint", {
              min: TOPUP_MIN_MAJOR_UNITS.toLocaleString("ru-RU"),
              max: formatRubMajor(TOPUP_MAX_MAJOR_UNITS),
            })}
          </span>
        </div>
        {errorMessage && <div className={styles.errMsg}>{errorMessage}</div>}
        {submitError && <div className={styles.errMsg}>{submitError}</div>}
      </div>

      <div className={styles.note}>
        <InfinityIcon />
        <span>{t("poolNote")}</span>
      </div>

      <div className={styles.ctaWrap}>
        <button
          className={`${dash.btn} ${dash.btnPrimary} ${styles.ctaBtn}`}
          disabled={!amount.isValid || isSubmitting}
          onClick={onSubmit}
          type="button"
        >
          {amount.isValid
            ? t("cta", { amount: formatRubMajor(amount.value) })
            : t("ctaEmpty")}
        </button>
        <div className={styles.fine}>{t("finePrint")}</div>
      </div>
    </>
  );
}

export type TopupProcessingProps = {
  amountMajor: number;
  onCancel: () => void;
};

export function TopupProcessing({
  amountMajor,
  onCancel,
}: TopupProcessingProps) {
  const t = useTranslations("auth.subscription.balance.topup");

  return (
    <div className={styles.result}>
      <div className={styles.spin} />
      <h4 className={styles.resultTitle}>{t("processing.title")}</h4>
      <p className={styles.resultText}>
        {t("processing.body", { amount: formatRubMajor(amountMajor) })}
      </p>
      <button
        className={`${dash.btn} ${dash.btnGhost} ${dash.btnSm}`}
        onClick={onCancel}
        style={{ marginTop: 12 }}
        type="button"
      >
        {t("processing.cancel")}
      </button>
    </div>
  );
}

export type TopupSuccessProps = {
  amountMajor: number;
  balanceTotalMinor: number;
  onDone: () => void;
};

export function TopupSuccess({
  amountMajor,
  balanceTotalMinor,
  onDone,
}: TopupSuccessProps) {
  const t = useTranslations("auth.subscription.balance.topup");

  return (
    <div className={styles.result}>
      <div className={`${styles.orb} ${styles.orbOk}`}>
        <CheckIcon />
      </div>
      <h4 className={styles.resultTitle}>{t("success.title")}</h4>
      <div className={styles.big}>+{formatRubMajor(amountMajor)}</div>
      <p className={styles.resultText}>
        {t("success.body")}{" "}
        <b>{formatCurrency(balanceTotalMinor, "RUB", RUB_MINOR_UNITS)}</b>.
      </p>
      <button
        className={`${dash.btn} ${dash.btnPrimary} ${dash.btnFull}`}
        onClick={onDone}
        style={{ marginTop: 14 }}
        type="button"
      >
        {t("success.done")}
      </button>
    </div>
  );
}

export type TopupFailedProps = {
  amountMajor: number;
  onRetry: () => void;
  onClose: () => void;
};

export function TopupFailed({
  amountMajor,
  onRetry,
  onClose,
}: TopupFailedProps) {
  const t = useTranslations("auth.subscription.balance.topup");

  return (
    <div className={styles.result}>
      <div className={`${styles.orb} ${styles.orbBad}`}>
        <WarnIcon />
      </div>
      <h4 className={styles.resultTitle}>{t("failed.title")}</h4>
      <p className={styles.resultText}>
        {t("failed.body", { amount: formatRubMajor(amountMajor) })}
      </p>
      <div className={styles.resultActions}>
        <button
          className={`${dash.btn} ${dash.btnPrimary} ${styles.resultActionPrimary}`}
          onClick={onRetry}
          type="button"
        >
          {t("failed.retry")}
        </button>
        <button
          className={`${dash.btn} ${dash.btnGhost}`}
          onClick={onClose}
          type="button"
        >
          {t("failed.close")}
        </button>
      </div>
    </div>
  );
}
