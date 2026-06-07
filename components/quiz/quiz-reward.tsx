"use client";

import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { QUIZ_ICON } from "./quiz-icons";
import styles from "./quiz-wizard.module.css";
import type { QuizReward } from "./types";

type QuizRewardScreenProps = {
  reward: QuizReward;
  onClose: () => void;
};

// Eight rays for the celebratory burst around the gift.
const SPARK_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

export function QuizRewardScreen({ reward, onClose }: QuizRewardScreenProps) {
  return (
    <div className={styles.reward}>
      <div className={cn(styles.gift, styles.burst)}>
        <span className={styles.giftCore}>{QUIZ_ICON.gift}</span>
        {SPARK_ANGLES.map((angle) => (
          <i
            className={styles.spark}
            key={`spark-${angle}`}
            style={{ "--a": `${angle}deg` } as CSSProperties}
          />
        ))}
      </div>

      <div className={styles.rewardAmount}>
        <span className={styles.rewardPlus}>{reward.amount}</span>
        {reward.unit && (
          <span className={styles.rewardUnit}>{reward.unit}</span>
        )}
      </div>

      <h2 className={styles.rewardTitle}>{reward.title}</h2>
      <p className={styles.rewardLede}>{reward.lede}</p>

      {reward.perks && reward.perks.length > 0 && (
        <div className={styles.rewardPerks}>
          {reward.perks.map((perk) => (
            <div className={styles.perk} key={perk.k}>
              <span className={styles.perkK}>{perk.k}</span>
              <span className={styles.perkV}>{perk.v}</span>
            </div>
          ))}
        </div>
      )}

      <button
        className={cn(styles.btn, styles.btnPrimary, styles.rewardCta)}
        onClick={onClose}
        type="button"
      >
        {reward.cta}
        {QUIZ_ICON.arrow}
      </button>

      {reward.note && <p className={styles.rewardNote}>{reward.note}</p>}
    </div>
  );
}
