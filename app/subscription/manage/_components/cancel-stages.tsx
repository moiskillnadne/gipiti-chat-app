"use client";

import { useState } from "react";
import { useTranslations } from "@/lib/i18n/translate";
import { CANCELLATION_REASONS } from "@/lib/subscription/cancellation-reasons";
import dash from "../../_components/dashboard.module.css";
import {
  CardIcon,
  CheckIcon,
  InfinityIcon,
  WarnIcon,
  XIcon,
} from "../../_components/icons";
import tu from "../../_components/top-up.module.css";
import styles from "./manage.module.css";
import type { CancelDialogData } from "./manage-types";

const SURVEY_OPTIONS = [
  { key: "tooExpensive", code: CANCELLATION_REASONS.TOO_EXPENSIVE },
  { key: "notUsingEnough", code: CANCELLATION_REASONS.NOT_USING_ENOUGH },
  { key: "missingFeatures", code: CANCELLATION_REASONS.MISSING_FEATURES },
  { key: "technicalIssues", code: CANCELLATION_REASONS.TECHNICAL_ISSUES },
  { key: "other", code: null },
] as const;

type CancelConfirmStageProps = {
  data: CancelDialogData;
  isSubmitting: boolean;
  hasError: boolean;
  onKeep: () => void;
  onConfirm: () => void;
};

export function CancelConfirmStage({
  data,
  isSubmitting,
  hasError,
  onKeep,
  onConfirm,
}: CancelConfirmStageProps) {
  const t = useTranslations("auth.subscription.manage.cancel");
  const tManage = useTranslations("auth.subscription.manage");

  return (
    <>
      <div className={tu.head}>
        <h3 className={tu.title}>{t("confirmTitle")}</h3>
        <button
          aria-label={tManage("closeAria")}
          className={tu.close}
          disabled={isSubmitting}
          onClick={onKeep}
          type="button"
        >
          <XIcon height={14} width={14} />
        </button>
      </div>

      <div className={styles.conseq}>
        <div className={styles.conseqRow}>
          <CheckIcon />
          <span>{t("rowAccess", { date: data.dateFull })}</span>
        </div>
        <div className={`${styles.conseqRow} ${styles.conseqWarn}`}>
          <WarnIcon />
          <span>
            {t("rowBurn", { amount: data.subAmount, date: data.dateShort })}
          </span>
        </div>
        <div className={styles.conseqRow}>
          <InfinityIcon />
          <span>{t("rowTopup", { amount: data.topupAmount })}</span>
        </div>
        {data.cardMask && (
          <div className={styles.conseqRow}>
            <CardIcon />
            <span>{t("rowCard", { card: data.cardMask })}</span>
          </div>
        )}
      </div>

      {hasError && <p className={styles.errMsg}>{t("error")}</p>}

      <div className={styles.actions}>
        <button
          className={`${dash.btn} ${dash.btnOutline} ${styles.actionWide}`}
          disabled={isSubmitting}
          onClick={onKeep}
          type="button"
        >
          {t("keep")}
        </button>
        <button
          className={`${dash.btn} ${dash.btnDanger} ${styles.actionGrow}`}
          disabled={isSubmitting}
          onClick={onConfirm}
          type="button"
        >
          {isSubmitting ? t("cancelling") : t("confirm")}
        </button>
      </div>

      <div className={tu.fine}>{t("fine")}</div>
    </>
  );
}

type CancelSurveyStageProps = {
  isSubmitting: boolean;
  onSubmit: (reason: string | null, otherText: string) => void;
};

export function CancelSurveyStage({
  isSubmitting,
  onSubmit,
}: CancelSurveyStageProps) {
  const t = useTranslations("auth.subscription.manage.cancel");
  const [selected, setSelected] = useState<number | null>(null);
  const [otherText, setOtherText] = useState("");

  const selectedOption = selected === null ? null : SURVEY_OPTIONS[selected];
  const isOther = selectedOption !== null && selectedOption.code === null;

  return (
    <>
      <div className={tu.head}>
        <h3 className={tu.title}>{t("surveyTitle")}</h3>
      </div>
      <p className={styles.surveyNote}>{t("surveyNote")}</p>

      <div className={styles.opts}>
        {SURVEY_OPTIONS.map((option, index) => (
          <button
            className={`${styles.opt} ${
              selected === index ? styles.optSelected : ""
            }`}
            key={option.key}
            onClick={() => setSelected(index)}
            type="button"
          >
            <span className={styles.radio} />
            {t(`reasons.${option.key}`)}
          </button>
        ))}
        {isOther && (
          <textarea
            className={styles.textarea}
            onChange={(event) => setOtherText(event.target.value)}
            placeholder={t("otherPlaceholder")}
            value={otherText}
          />
        )}
      </div>

      <div className={styles.actions}>
        <button
          className={`${dash.btn} ${dash.btnPrimary} ${styles.actionGrow}`}
          disabled={selectedOption === null || isSubmitting}
          onClick={() =>
            selectedOption && onSubmit(selectedOption.code, otherText)
          }
          type="button"
        >
          {t("send")}
        </button>
        <button
          className={`${dash.btn} ${dash.btnGhost}`}
          disabled={isSubmitting}
          onClick={() => onSubmit(null, "")}
          type="button"
        >
          {t("skip")}
        </button>
      </div>
    </>
  );
}

type CancelDoneStageProps = {
  data: CancelDialogData;
  onDone: () => void;
};

export function CancelDoneStage({ data, onDone }: CancelDoneStageProps) {
  const t = useTranslations("auth.subscription.manage.cancel");

  return (
    <div className={tu.result}>
      <div className={`${tu.orb} ${styles.orbCalm}`}>
        <CheckIcon />
      </div>
      <h4 className={tu.resultTitle}>{t("doneTitle")}</h4>
      <p className={tu.resultText}>
        {t("doneBody", {
          date: data.dateFull,
          subAmount: data.subAmount,
          topupAmount: data.topupAmount,
        })}
      </p>
      <div className={tu.resultActions}>
        <button
          className={`${dash.btn} ${dash.btnPrimary} ${dash.btnFull}`}
          onClick={onDone}
          type="button"
        >
          {t("doneOk")}
        </button>
      </div>
      <div className={tu.fine}>{t("doneFine", { date: data.dateShort })}</div>
    </div>
  );
}
