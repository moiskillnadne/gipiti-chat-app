import Link from "next/link";
import { getTranslations } from "@/lib/i18n/translate";
import styles from "./dashboard.module.css";
import { GiftIcon, MailIcon } from "./icons";

type FreePlanCardProps = {
  email: string;
  emailVerified: boolean;
  tokenBonus: number;
};

export async function FreePlanCard({
  email,
  emailVerified,
  tokenBonus,
}: FreePlanCardProps) {
  const t = await getTranslations("auth.subscription.dashboard.plan");
  const tCycle = await getTranslations("auth.subscription.dashboard.cycle");
  const tFree = await getTranslations("auth.subscription.dashboard.plan.free");

  const bonusAmount = Math.round(tokenBonus / 1000);

  return (
    <section aria-label={t("title")} className={styles.card}>
      <div className={styles.cardHead}>
        <h3 className={styles.cardTitle}>{t("title")}</h3>
        {emailVerified ? null : (
          <span className={`${styles.cardBadge} ${styles.cardBadgeWarn}`}>
            {t("badge.unverified")}
          </span>
        )}
      </div>

      <div className={styles.planRow}>
        <span className={styles.planNm}>
          {tFree("name")}
          <em className={styles.planNmEm}>{tFree("nameEm")}</em>
        </span>
        <span className={styles.planPr}>
          {t("priceLabel")}
          <b>0 ₽</b>
        </span>
      </div>

      <div className={styles.planMeta}>
        <div>
          <div className={styles.planMetaK}>{t("meta.period")}</div>
          <div className={styles.planMetaV}>{tCycle("lifetimeValue")}</div>
        </div>
        <div>
          <div className={styles.planMetaK}>{tFree("resetLabel")}</div>
          <div className={styles.planMetaV}>{tFree("resetValueNone")}</div>
        </div>
        <div>
          <div className={styles.planMetaK}>{tFree("emailLabel")}</div>
          <div
            className={`${styles.planMetaV} ${
              emailVerified ? styles.planMetaVSuccess : styles.planMetaVWarn
            }`}
          >
            {emailVerified
              ? `✓ ${tFree("emailVerified")}`
              : tFree("emailUnverified")}
          </div>
        </div>
        <div>
          <div className={styles.planMetaK}>{tFree("addressLabel")}</div>
          <div className={`${styles.planMetaV} ${styles.planMetaVMono}`}>
            {email}
          </div>
        </div>
      </div>

      {emailVerified ? null : (
        <div className={styles.rewardNote}>
          <span className={styles.rewardNoteIcon}>
            <GiftIcon />
          </span>
          <div className={styles.rewardNoteText}>
            <div className={styles.rewardNoteTitle}>
              {tFree("rewardNoteTitle")}{" "}
              <span className={styles.rewardNoteAmount}>
                {tFree("rewardNoteAmount", { amount: bonusAmount })}
              </span>
            </div>
            <div className={styles.rewardNoteBody}>
              {tFree("rewardNoteBody")}
            </div>
          </div>
        </div>
      )}

      <Link
        className={`${styles.btn} ${styles.btnPrimary} ${styles.btnFull} ${styles.planCta}`}
        href={
          emailVerified ? "/manage-subscription" : "/subscription/confirm-email"
        }
      >
        {emailVerified ? null : <MailIcon />}
        {emailVerified ? tFree("viewPlansCta") : tFree("confirmEmailCta")}
      </Link>
    </section>
  );
}
