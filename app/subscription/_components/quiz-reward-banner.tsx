"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { QuizWizard } from "@/components/quiz/quiz-wizard";
import { useOnboardingQuizConfig } from "@/components/quiz/use-onboarding-quiz-config";
import { toast } from "@/components/toast";
import { useTranslations } from "@/lib/i18n/translate";
import { ONBOARDING_QUIZ_KEY, type QuizAnswers } from "@/lib/quiz/types";
import styles from "./dashboard.module.css";
import { GiftIcon } from "./icons";

export type QuizRewardBannerProps = {
  bonusAmount: string;
};

export function QuizRewardBanner({ bonusAmount }: QuizRewardBannerProps) {
  const t = useTranslations("onboardingQuiz.banner");
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const config = useOnboardingQuizConfig(bonusAmount);

  const handleComplete = async (answers: QuizAnswers) => {
    const response = await fetch(`/api/quiz/${ONBOARDING_QUIZ_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    });

    if (!response.ok) {
      toast({ type: "error", description: t("error") });
      throw new Error("quiz_submit_failed");
    }

    setIsCompleted(true);
  };

  const handleOpenChange = (next: boolean) => {
    setIsOpen(next);
    // Once the reward screen is dismissed, refresh so the server re-queries
    // completion and hides this banner.
    if (!next && isCompleted) {
      router.refresh();
    }
  };

  return (
    <>
      <div className={`${styles.banner} ${styles.bannerReward}`}>
        <span className={styles.rewardGift}>
          <GiftIcon />
        </span>

        <div className={styles.bannerBody}>
          <b>
            {t("title")}
            <span className={styles.rewardAmount}>
              {t("amount", { amount: bonusAmount })}
            </span>
          </b>
          <span>{t("body")}</span>
        </div>

        <div className={styles.bannerActions}>
          <button
            className={`${styles.btn} ${styles.btnReward} ${styles.btnSm}`}
            onClick={() => setIsOpen(true)}
            type="button"
          >
            {t("action")}
          </button>
        </div>
      </div>

      <QuizWizard
        config={config}
        onComplete={handleComplete}
        onOpenChange={handleOpenChange}
        open={isOpen}
      />
    </>
  );
}
