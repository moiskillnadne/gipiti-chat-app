"use client";

import { CheckIcon, GiftIcon } from "@/app/subscription/_components/icons";
import { useTranslations } from "@/lib/i18n/translate";
import styles from "./confirm-email.module.css";

type RewardCardProps = {
  variant: "pending" | "unlocked";
  email?: string;
};

export function RewardCard({ variant, email }: RewardCardProps) {
  const t = useTranslations("auth.confirmEmail");

  if (variant === "unlocked") {
    return (
      <aside className={styles.rewardCard}>
        <div className={styles.rewardHead}>
          <span className={`${styles.giftBig} ${styles.giftBigSuccess}`}>
            <CheckIcon />
          </span>
          <div className={styles.rewardTitleBlock}>
            <h4>{t("unlockedHeading")}</h4>
            <p>{t("unlockedSub")}</p>
          </div>
        </div>

        <div className={styles.rewardStats}>
          <div>
            <div className={styles.rewardStatKey}>
              {t("unlockedStatTokens")}
            </div>
            <div className={styles.rewardStatVal}>
              20K
              <span className={styles.rewardStatArrow}>→</span>
              <span className={styles.rewardStatValBold}>70K</span>
            </div>
          </div>
          <div>
            <div className={styles.rewardStatKey}>
              {t("rewardStatMessages")}
            </div>
            <div className={styles.rewardStatVal}>
              20
              <span className={styles.rewardStatArrow}>→</span>
              <span className={styles.rewardStatValBold}>100</span>
            </div>
          </div>
          <div>
            <div className={styles.rewardStatKey}>{t("rewardStatSearch")}</div>
            <div className={styles.rewardStatVal}>
              5<span className={styles.rewardStatArrow}>→</span>
              <span className={styles.rewardStatValBold}>40</span>
            </div>
          </div>
          <div>
            <div className={styles.rewardStatKey}>{t("rewardStatPlans")}</div>
            <div className={styles.successPlansAvailable}>
              {t("unlockedStatPlansAvailable")}
            </div>
          </div>
        </div>

        <div className={styles.rewardFoot}>
          {t("unlockedFootPrefix")} <em>{email ?? ""}</em>.
        </div>
      </aside>
    );
  }

  return (
    <aside className={styles.rewardCard}>
      <div className={styles.rewardHead}>
        <span className={styles.giftBig}>
          <GiftIcon />
        </span>
        <div className={styles.rewardTitleBlock}>
          <h4>{t("bonusTitle")}</h4>
          <p>{t("bonusSub")}</p>
        </div>
      </div>

      <h3 className={styles.rewardHeadline}>
        {t("bonusHeading")}
        <span className={styles.rewardHeadlineUnit}>{t("bonusUnit")}</span>
      </h3>

      <div className={styles.rewardStats}>
        <div>
          <div className={styles.rewardStatKey}>{t("rewardStatMessages")}</div>
          <div className={styles.rewardStatVal}>
            20
            <span className={styles.rewardStatArrow}>→</span>
            <span>100</span>
            <span className={styles.rewardStatNew}>+80</span>
          </div>
        </div>
        <div>
          <div className={styles.rewardStatKey}>{t("rewardStatSearch")}</div>
          <div className={styles.rewardStatVal}>
            5<span className={styles.rewardStatArrow}>→</span>
            <span>40</span>
            <span className={styles.rewardStatNew}>+35</span>
          </div>
        </div>
        <div>
          <div className={styles.rewardStatKey}>{t("rewardStatImages")}</div>
          <div className={styles.rewardStatVal}>
            1<span className={styles.rewardStatArrow}>→</span>
            <span>10</span>
            <span className={styles.rewardStatNew}>+9</span>
          </div>
        </div>
        <div>
          <div className={styles.rewardStatKey}>{t("rewardStatPlans")}</div>
          <div className={styles.rewardStatVal}>
            <span className={styles.rewardStatNew}>
              {t("rewardStatPlansValue")}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.rewardFoot}>
        {t("rewardFoot")} <em>{t("rewardFootEm")}</em>
        {t("rewardFootRest")}
      </div>
    </aside>
  );
}
