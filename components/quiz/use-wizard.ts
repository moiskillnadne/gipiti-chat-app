"use client";

import { useCallback, useState } from "react";
import type {
  QuizAnswers,
  QuizAnswerValue,
  QuizConfig,
  QuizQuestion,
} from "./types";

export type WizardPhase = "intro" | "quiz" | "reward";

export type OnQuizComplete = (answers: QuizAnswers) => Promise<void>;

// Whether a question has a valid answer — drives the "next" button and step
// validity. Required text must be non-empty; a radio "other" option additionally
// requires its inline free-text (stored under `${id}_other`).
export function isQuestionAnswered(
  question: QuizQuestion,
  answers: QuizAnswers
): boolean {
  if (question.optional) {
    return true;
  }

  const value = answers[question.id];

  if (question.type === "checkbox" || question.type === "cards") {
    return Array.isArray(value) && value.length > 0;
  }

  if (question.type === "rating") {
    return typeof value === "number" && value > 0;
  }

  if (question.type === "text") {
    return typeof value === "string" && value.trim().length > 0;
  }

  // radio
  if (typeof value !== "string" || value === "") {
    return false;
  }

  const selected = question.options.find((option) => option.value === value);
  if (selected?.withText) {
    const other = answers[`${question.id}_other`];
    return typeof other === "string" && other.trim().length > 0;
  }

  return true;
}

export type Wizard = {
  phase: WizardPhase;
  step: number;
  question: QuizQuestion | undefined;
  value: QuizAnswerValue | undefined;
  answers: QuizAnswers;
  total: number;
  current: number;
  canNext: boolean;
  atLast: boolean;
  submitting: boolean;
  error: string | null;
  setAnswer: (id: string, value: QuizAnswerValue) => void;
  goNext: () => Promise<void>;
  goBack: () => void;
};

export function useWizard(
  config: QuizConfig,
  onComplete: OnQuizComplete
): Wizard {
  const questions = config.questions;
  const total = questions.length;

  const [phase, setPhase] = useState<WizardPhase>("intro");
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswers>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const question = questions[step];
  const value = question ? answers[question.id] : undefined;
  const canNext = question ? isQuestionAnswered(question, answers) : true;

  const setAnswer = useCallback((id: string, next: QuizAnswerValue) => {
    setAnswers((current) => ({ ...current, [id]: next }));
  }, []);

  const goNext = useCallback(async () => {
    if (phase === "intro") {
      setPhase("quiz");
      return;
    }

    if (step < total - 1) {
      setStep((current) => current + 1);
      return;
    }

    // Last question — persist before revealing the reward.
    setSubmitting(true);
    setError(null);
    try {
      await onComplete(answers);
      setPhase("reward");
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "submit_failed"
      );
    } finally {
      setSubmitting(false);
    }
  }, [phase, step, total, onComplete, answers]);

  const goBack = useCallback(() => {
    if (phase === "quiz" && step === 0) {
      setPhase("intro");
      return;
    }
    if (step > 0) {
      setStep((current) => current - 1);
    }
  }, [phase, step]);

  return {
    phase,
    step,
    question,
    value,
    answers,
    total,
    current: step + 1,
    canNext,
    atLast: step === total - 1,
    submitting,
    error,
    setAnswer,
    goNext,
    goBack,
  };
}
