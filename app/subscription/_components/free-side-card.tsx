import Link from "next/link";
import { getTranslations } from "@/lib/i18n/translate";
import styles from "./dashboard.module.css";
import { ArrowRightIcon, BoltIcon, GiftIcon, InfinityIcon } from "./icons";

const SUBSCRIBE_HREF = "/manage-subscription";

export type FreeSideCardProps = {
  welcomeAmount: string;
};

export async function FreeSideCard({ welcomeAmount }: FreeSideCardProps) {
  const t = await getTranslations("auth.subscription.balance.free");

  return (
    <section aria-label={t("title")} className={styles.card}>
      <div className={styles.cardHead}>
        <h3 className={styles.cardTitle}>{t("title")}</h3>
        <span className={styles.cardMeta}>{t("badge")}</span>
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

      <div className={styles.freeFeatures}>
        <span className={styles.freeFeature}>
          <BoltIcon />
          {t("features.models")}
        </span>
        <span className={styles.freeFeature}>
          <InfinityIcon />
          {t("features.payg")}
        </span>
        <span className={styles.freeFeature}>
          <GiftIcon />
          {t("features.welcome", { amount: welcomeAmount })}
        </span>
      </div>

      <div className={styles.freeCtas}>
        <Link
          className={`${styles.btn} ${styles.btnPrimary} ${styles.btnFull}`}
          href={SUBSCRIBE_HREF}
        >
          {t("subscribe")}
          <ArrowRightIcon />
        </Link>
        <Link
          className={`${styles.btn} ${styles.btnGhost} ${styles.btnFull}`}
          href={SUBSCRIBE_HREF}
        >
          {t("comparePlans")}
        </Link>
      </div>
    </section>
  );
}
