"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "@/lib/i18n/translate";
import type { BalanceViewState } from "@/lib/subscription/subscription-state";
import styles from "./dashboard.module.css";
import { PauseIcon, WarnIcon } from "./icons";

const MANAGE_HREF = "/manage-subscription";

export type StatusBannerProps = {
  state: BalanceViewState;
  cancelledDate: string | null;
  cancelledSubAmount: string;
  cancelledTopupAmount: string;
  pastDuePrice: string;
  pastDueCardMask: string | null;
  pastDueRetryIn: string | null;
};

export function StatusBanner(props: StatusBannerProps) {
  switch (props.state) {
    case "cancelled":
      return <CancelledBanner {...props} />;
    case "past_due":
      return <PastDueBanner {...props} />;
    case "low":
      return <LowBanner />;
    case "free_zero":
      return <ZeroBanner />;
    default:
      return null;
  }
}

function CancelledBanner({
  cancelledDate,
  cancelledSubAmount,
  cancelledTopupAmount,
}: StatusBannerProps) {
  const router = useRouter();
  const t = useTranslations("auth.subscription.balance.banner.cancelled");

  return (
    <div
      className={`${styles.banner} ${styles.bannerCancelled} ${styles.marginBottom16}`}
    >
      <PauseIcon className={styles.bannerIcon} />
      <div className={styles.bannerBody}>
        <b>{t("title", { date: cancelledDate ?? "—" })}</b>
        <span>
          {t("body", { sub: cancelledSubAmount, topup: cancelledTopupAmount })}
        </span>
      </div>
      <div className={styles.bannerActions}>
        <button
          className={`${styles.btn} ${styles.btnOutline} ${styles.btnSm}`}
          onClick={() => router.push(MANAGE_HREF)}
          type="button"
        >
          {t("resume")}
        </button>
      </div>
    </div>
  );
}

function PastDueBanner({
  pastDuePrice,
  pastDueCardMask,
  pastDueRetryIn,
}: StatusBannerProps) {
  const router = useRouter();
  const t = useTranslations("auth.subscription.balance.banner.pastDue");

  return (
    <div
      className={`${styles.banner} ${styles.bannerPastDue} ${styles.marginBottom16}`}
    >
      <WarnIcon className={styles.bannerIcon} />
      <div className={styles.bannerBody}>
        <b>
          {t("title", {
            price: pastDuePrice,
            cardMask: pastDueCardMask ?? "—",
          })}
        </b>
        <span>{t("body", { retryIn: pastDueRetryIn ?? t("soon") })}</span>
      </div>
      <div className={styles.bannerActions}>
        <button
          className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`}
          onClick={() => router.push(MANAGE_HREF)}
          type="button"
        >
          {t("updateCard")}
        </button>
      </div>
    </div>
  );
}

function LowBanner() {
  const t = useTranslations("auth.subscription.balance.banner.low");

  return (
    <div
      className={`${styles.banner} ${styles.bannerLow} ${styles.marginBottom16}`}
    >
      <WarnIcon className={styles.bannerIcon} />
      <div className={styles.bannerBody}>
        <b>{t("title")}</b>
        <span>{t("body")}</span>
      </div>
    </div>
  );
}

function ZeroBanner() {
  const router = useRouter();
  const t = useTranslations("auth.subscription.balance.banner.zero");

  return (
    <div
      className={`${styles.banner} ${styles.bannerZero} ${styles.marginBottom16}`}
    >
      <WarnIcon className={styles.bannerIcon} />
      <div className={styles.bannerBody}>
        <b>{t("title")}</b>
        <span>{t("body")}</span>
      </div>
      <div className={styles.bannerActions}>
        <button
          className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`}
          onClick={() => router.push(MANAGE_HREF)}
          type="button"
        >
          {t("subscribe")}
        </button>
      </div>
    </div>
  );
}
