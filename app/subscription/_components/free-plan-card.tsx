"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "@/lib/i18n/translate";
import styles from "./dashboard.module.css";
import { ArrowRightIcon, GiftIcon, MailIcon } from "./icons";

const CONFIRM_EMAIL_HREF = "/confirm-email";
const VIEW_PLANS_HREF = "/manage-subscription";

type FreePlanCardProps = {
  emailVerified: boolean;
  email: string;
  rewardAmountK: number;
};

export function FreePlanCard({
  emailVerified,
  email,
  rewardAmountK,
}: FreePlanCardProps) {
  const router = useRouter();
  const t = useTranslations("auth.subscription.dashboard.freePlan");
  const showReward = !emailVerified && rewardAmountK > 0;

  return (
    <section aria-label={t("title")} className={styles.card}>
      <div className={styles.cardHead}>
        <h3 className={styles.cardTitle}>{t("title")}</h3>
        <span
          className={
            emailVerified
              ? styles.cardBadge
              : `${styles.cardBadge} ${styles.cardBadgeWarn}`
          }
        >
          {emailVerified ? t("badge.verified") : t("badge.unverified")}
        </span>
      </div>

      <div className={styles.planRow}>
        <span className={styles.planNm}>
          {t("name")}
          <span className={styles.planNmEm}>{t("tagline")}</span>
        </span>
        <span className={styles.planPr}>
          {t("priceLabel")}
          <b>{t("priceValue")}</b>
        </span>
      </div>

      <div className={styles.planMeta}>
        <div>
          <div className={styles.planMetaK}>{t("meta.email")}</div>
          <div
            className={
              emailVerified
                ? styles.planMetaValueVerified
                : styles.planMetaValueUnverified
            }
          >
            {emailVerified
              ? t("meta.emailVerified")
              : t("meta.emailUnverified")}
          </div>
        </div>
        <div>
          <div className={styles.planMetaK}>{t("meta.address")}</div>
          <div className={styles.planMetaValueMono}>{email}</div>
        </div>
      </div>

      {showReward && (
        <div className={styles.rewardNote}>
          <span className={styles.rewardNoteGift}>
            <GiftIcon />
          </span>
          <div className={styles.rewardNoteText}>
            <b>
              {t("reward.title")}{" "}
              <span className={styles.rewardNoteAmount}>
                {t("reward.amount", { amount: rewardAmountK })}
              </span>
            </b>
            <span>{t("reward.body")}</span>
          </div>
        </div>
      )}

      <button
        className={`${styles.btn} ${styles.btnPrimary} ${styles.btnFull} ${styles.planCtaSpacer}`}
        onClick={() =>
          router.push(emailVerified ? VIEW_PLANS_HREF : CONFIRM_EMAIL_HREF)
        }
        type="button"
      >
        {emailVerified ? (
          <>
            {t("cta.viewPlans")}
            <ArrowRightIcon />
          </>
        ) : (
          <>
            <MailIcon />
            {t("cta.verify")}
          </>
        )}
      </button>
    </section>
  );
}
