"use client";

import { useMemo } from "react";
import { type TranslateFn, useTranslations } from "@/lib/i18n/translate";
import { ONBOARDING_QUIZ_KEY } from "@/lib/quiz/types";
import {
  ONBOARDING_QUIZ_STRUCTURE,
  type QuestionStructure,
} from "./onboarding-quiz";
import type { QuizConfig, QuizOption, QuizQuestion } from "./types";

function buildChoiceOptions(
  structure: QuestionStructure,
  t: TranslateFn
): QuizOption[] {
  if (!("options" in structure)) {
    return [];
  }
  return structure.options.map((option) => {
    const base = `questions.${structure.id}.options.${option.value}`;
    return {
      value: option.value,
      label: t(`${base}.label`),
      desc:
        "withDesc" in structure && structure.withDesc
          ? t(`${base}.desc`)
          : undefined,
      icon: option.icon,
      model: option.model,
      withText: option.withText,
      textPlaceholder: option.withText
        ? t(`questions.${structure.id}.otherPlaceholder`)
        : undefined,
    };
  });
}

function buildQuestion(
  structure: QuestionStructure,
  t: TranslateFn
): QuizQuestion {
  const id = structure.id;
  const base = {
    id,
    eyebrow: t(`questions.${id}.eyebrow`),
    title: t(`questions.${id}.title`),
    help: t(`questions.${id}.help`),
  };

  if (structure.type === "rating") {
    return {
      ...base,
      type: "rating",
      min: structure.min,
      max: structure.max,
      lowLabel: t(`questions.${id}.lowLabel`),
      highLabel: t(`questions.${id}.highLabel`),
    };
  }

  if (structure.type === "text") {
    return {
      ...base,
      type: "text",
      optional: structure.optional ?? false,
      placeholder: t(`questions.${id}.placeholder`),
    };
  }

  if (structure.type === "radio") {
    return {
      ...base,
      type: "radio",
      options: buildChoiceOptions(structure, t),
    };
  }

  return {
    ...base,
    type: structure.type,
    options: buildChoiceOptions(structure, t),
    exclusiveValue: structure.exclusiveValue,
  };
}

// Builds the fully-resolved onboarding QuizConfig the widget renders, merging the
// language-agnostic structure with the "onboardingQuiz" translations. `bonusAmount`
// is the pre-formatted reward (e.g. "50 ₽") from the server.
export function useOnboardingQuizConfig(bonusAmount: string): QuizConfig {
  const t = useTranslations("onboardingQuiz");

  return useMemo(() => {
    const questions = ONBOARDING_QUIZ_STRUCTURE.map((structure) =>
      buildQuestion(structure, t)
    );

    return {
      key: ONBOARDING_QUIZ_KEY,
      questions,
      intro: {
        eyebrow: t("intro.eyebrow"),
        title: t("intro.title"),
        lede: t("intro.lede"),
        cta: t("intro.cta"),
        rewardLabel: t("intro.rewardLabel"),
      },
      reward: {
        amount: `+${bonusAmount}`,
        title: t("reward.title"),
        lede: t("reward.lede"),
        note: t("reward.note"),
        cta: t("reward.cta"),
      },
      nav: {
        back: t("nav.back"),
        next: t("nav.next"),
        finish: t("nav.finish"),
        close: t("nav.close"),
        questionsCount: t("nav.questionsCount", { count: questions.length }),
        optionalLabel: t("nav.optionalLabel"),
        submitError: t("nav.submitError"),
      },
    };
  }, [t, bonusAmount]);
}
