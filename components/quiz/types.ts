import type { QuizIconName } from "./quiz-icons";

export type { QuizAnswers, QuizAnswerValue } from "@/lib/quiz/types";

export type ModelDotKey = "claude" | "gpt" | "gemini" | "grok";

export type QuizOption = {
  value: string;
  label: string;
  desc?: string;
  icon?: QuizIconName;
  model?: ModelDotKey | null;
  // When selected, reveal an inline free-text input (e.g. the "Другое" option).
  withText?: boolean;
  textPlaceholder?: string;
};

type BaseQuestion = {
  id: string;
  eyebrow: string;
  title: string;
  help?: string;
  // Optional questions never block the "next" button.
  optional?: boolean;
};

export type RadioQuestion = BaseQuestion & {
  type: "radio";
  options: QuizOption[];
};

export type ChoiceQuestion = BaseQuestion & {
  type: "checkbox" | "cards";
  options: QuizOption[];
  // A value that clears all others when chosen (e.g. "none" → "Ещё не пробовал").
  exclusiveValue?: string;
};

export type RatingQuestion = BaseQuestion & {
  type: "rating";
  min: number;
  max: number;
  lowLabel: string;
  highLabel: string;
};

export type TextQuestion = BaseQuestion & {
  type: "text";
  placeholder?: string;
};

export type QuizQuestion =
  | RadioQuestion
  | ChoiceQuestion
  | RatingQuestion
  | TextQuestion;

export type QuizIntro = {
  eyebrow: string;
  title: string;
  lede: string;
  cta: string;
  rewardLabel: string;
};

export type QuizRewardPerk = { k: string; v: string };

export type QuizReward = {
  // Pre-formatted amount, e.g. "+50 ₽".
  amount: string;
  unit?: string;
  title: string;
  lede: string;
  note?: string;
  cta: string;
  perks?: QuizRewardPerk[];
};

export type QuizNav = {
  back: string;
  next: string;
  finish: string;
  close: string;
  // Pre-formatted count line, e.g. "6 вопросов".
  questionsCount: string;
  optionalLabel: string;
  submitError: string;
};

export type QuizConfig = {
  key: string;
  intro: QuizIntro;
  questions: QuizQuestion[];
  reward: QuizReward;
  nav: QuizNav;
};

export type ProgressStyle = "counter" | "bar" | "dots" | "segments";
