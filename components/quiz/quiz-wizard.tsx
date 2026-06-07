"use client";

import { Dialog as DialogPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";
import { QuizField } from "./quiz-field";
import { QUIZ_ICON } from "./quiz-icons";
import { QuizProgress } from "./quiz-progress";
import { QuizRewardScreen } from "./quiz-reward";
import styles from "./quiz-wizard.module.css";
import type { ProgressStyle, QuizConfig, QuizQuestion } from "./types";
import { type OnQuizComplete, useWizard } from "./use-wizard";

type QuizWizardProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: QuizConfig;
  onComplete: OnQuizComplete;
  progressStyle?: ProgressStyle;
};

// Subtle entrance reveal applied to each step (transform-only, opacity stays 1).
const REVEAL = cn(styles.rv, styles.rvSubtle);

function StepHead({ question }: { question: QuizQuestion }) {
  return (
    <div className={styles.stepHead}>
      <span className={styles.eyebrow}>
        <i />
        {question.eyebrow}
      </span>
      <h2 className={styles.qTitle}>{question.title}</h2>
      {question.help && <p className={styles.qHelp}>{question.help}</p>}
    </div>
  );
}

export function QuizWizard({
  open,
  onOpenChange,
  config,
  onComplete,
  progressStyle = "segments",
}: QuizWizardProps) {
  const wizard = useWizard(config, onComplete);
  const { intro, reward, nav } = config;
  const rewardSuffix = reward.unit ? ` ${reward.unit}` : "";

  return (
    <DialogPrimitive.Root onOpenChange={onOpenChange} open={open}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={styles.scrim} />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={cn(styles.modal, styles.modalA)}
        >
          <DialogPrimitive.Title className={styles.srOnly}>
            {intro.title}
          </DialogPrimitive.Title>

          <div className={styles.mtop}>
            <DialogPrimitive.Close
              aria-label={nav.close}
              className={styles.mtopX}
            >
              {QUIZ_ICON.close}
            </DialogPrimitive.Close>
          </div>

          {wizard.phase === "intro" && (
            <div className={cn(styles.step, REVEAL)} key="intro">
              <div className={styles.intro}>
                <span className={styles.introGift}>{QUIZ_ICON.spark}</span>
                <span className={styles.eyebrow}>
                  <i />
                  {intro.eyebrow}
                </span>
                <h2 className={styles.introTitle}>{intro.title}</h2>
                <p className={styles.introLede}>{intro.lede}</p>
                <div className={styles.introReward}>
                  <span className={styles.tagGift}>{QUIZ_ICON.gift}</span>
                  {intro.rewardLabel}{" "}
                  <b>
                    {reward.amount}
                    {rewardSuffix}
                  </b>
                </div>
              </div>
              <div className={styles.foot}>
                <span className={styles.footMeta}>{nav.questionsCount}</span>
                <button
                  className={cn(styles.btn, styles.btnPrimary)}
                  onClick={() => wizard.goNext()}
                  type="button"
                >
                  {intro.cta}
                  {QUIZ_ICON.arrow}
                </button>
              </div>
            </div>
          )}

          {wizard.phase === "quiz" && wizard.question && (
            <>
              <div className={styles.bar}>
                <QuizProgress
                  current={wizard.current}
                  total={wizard.total}
                  variant={progressStyle}
                />
              </div>
              <div
                className={cn(styles.step, styles.body, REVEAL)}
                key={wizard.step}
              >
                <StepHead question={wizard.question} />
                <QuizField
                  answers={wizard.answers}
                  optionalLabel={nav.optionalLabel}
                  question={wizard.question}
                  setAnswer={wizard.setAnswer}
                />
              </div>
              <div className={styles.foot}>
                <button
                  className={cn(styles.btn, styles.btnGhost)}
                  onClick={wizard.goBack}
                  type="button"
                >
                  {QUIZ_ICON.back}
                  {nav.back}
                </button>
                {wizard.error ? (
                  <span className={styles.footError}>{nav.submitError}</span>
                ) : (
                  <span />
                )}
                <button
                  className={cn(styles.btn, styles.btnPrimary)}
                  disabled={!wizard.canNext || wizard.submitting}
                  onClick={() => wizard.goNext()}
                  type="button"
                >
                  {wizard.atLast ? nav.finish : nav.next}
                  {QUIZ_ICON.arrow}
                </button>
              </div>
            </>
          )}

          {wizard.phase === "reward" && (
            <div
              className={cn(styles.step, styles.paneCenter, REVEAL)}
              key="reward"
            >
              <QuizRewardScreen
                onClose={() => onOpenChange(false)}
                reward={reward}
              />
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
