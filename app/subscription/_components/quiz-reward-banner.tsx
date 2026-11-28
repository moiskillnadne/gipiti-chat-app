"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  getApiErrorMessageKey,
  getApiErrorReason,
} from "@/client/shared/api/errors";
import { api } from "@/client/shared/api/orpc-client";
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
  const tErrors = useTranslations("errors");
  const tApi = useTranslations("onboardingQuiz.api");
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const config = useOnboardingQuizConfig(bonusAmount);

  const handleComplete = async (answers: QuizAnswers) => {
    try {
      await api.me.quizzes.submit({ quizKey: ONBOARDING_QUIZ_KEY, answers });
    } catch (error) {
      // The server no longer sends a localized message, so the page picks one.
      // `null` means the call was aborted by the page itself: no toast.
      const errorKey = getApiErrorMessageKey(error);
      if (errorKey) {
        const isEmailNotVerified =
          getApiErrorReason(error) === "email_not_verified";
        toast({
          type: "error",
          description: isEmailNotVerified
            ? tApi("emailNotVerified")
            : tErrors(errorKey),
        });
      }
      // The wizard shows its own failure state when this rejects.
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
