// Structural definition of the onboarding quiz: question ids, control types,
// option values, icons and select behaviour. Display strings live in i18n
// (messages/ru.json → "onboardingQuiz") and are merged in by
// `useOnboardingQuizConfig`, so this file stays language-agnostic and reusable
// as the template for future quizzes.

import type { QuizIconName } from "./quiz-icons";
import type { ModelDotKey } from "./types";

type OptionStructure = {
  value: string;
  icon?: QuizIconName;
  model?: ModelDotKey | null;
  // Reveals an inline free-text input when chosen (the "Другое" option).
  withText?: boolean;
};

export type QuestionStructure =
  | {
      id: string;
      type: "radio";
      withDesc?: boolean;
      options: OptionStructure[];
    }
  | {
      id: string;
      type: "checkbox" | "cards";
      withDesc?: boolean;
      exclusiveValue?: string;
      options: OptionStructure[];
    }
  | { id: string; type: "rating"; min: number; max: number }
  | { id: string; type: "text"; optional?: boolean };

export const ONBOARDING_QUIZ_STRUCTURE: QuestionStructure[] = [
  {
    id: "sphere",
    type: "radio",
    options: [
      { value: "it", icon: "code" },
      { value: "marketing", icon: "image" },
      { value: "student", icon: "study" },
      { value: "other", icon: "doc", withText: true },
    ],
  },
  {
    id: "purpose",
    type: "checkbox",
    withDesc: true,
    options: [
      { value: "work", icon: "work" },
      { value: "study", icon: "study" },
      { value: "personal", icon: "personal" },
      { value: "explore", icon: "explore" },
    ],
  },
  {
    id: "create",
    type: "cards",
    options: [
      { value: "text", icon: "text" },
      { value: "image", icon: "image" },
      { value: "code", icon: "code" },
      { value: "video", icon: "video" },
    ],
  },
  {
    id: "models",
    type: "checkbox",
    exclusiveValue: "none",
    options: [
      { value: "gpt", model: "gpt" },
      { value: "claude", model: "claude" },
      { value: "gemini", model: "gemini" },
      { value: "grok", model: "grok" },
      { value: "none", model: null },
    ],
  },
  { id: "level", type: "rating", min: 1, max: 5 },
  { id: "contacts", type: "text", optional: false },
];
