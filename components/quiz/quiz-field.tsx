"use client";

import { cn } from "@/lib/utils";
import { QUIZ_ICON } from "./quiz-icons";
import styles from "./quiz-wizard.module.css";
import type {
  ChoiceQuestion,
  ModelDotKey,
  QuizAnswers,
  QuizAnswerValue,
  QuizQuestion,
  RadioQuestion,
  RatingQuestion,
  TextQuestion,
} from "./types";

type SetAnswer = (id: string, value: QuizAnswerValue) => void;

type QuizFieldProps = {
  question: QuizQuestion;
  answers: QuizAnswers;
  setAnswer: SetAnswer;
  optionalLabel: string;
};

function ModelDot({ model }: { model?: ModelDotKey | null }) {
  const background = model ? `var(--model-${model})` : "var(--ink-4)";
  return <span className={styles.mdot} style={{ background }} />;
}

function asArray(value: QuizAnswerValue | undefined): string[] {
  return Array.isArray(value) ? value : [];
}

function RadioField({
  question,
  answers,
  setAnswer,
}: {
  question: RadioQuestion;
  answers: QuizAnswers;
  setAnswer: SetAnswer;
}) {
  const value = answers[question.id];
  const selected = question.options.find((option) => option.value === value);

  return (
    <>
      <div className={styles.opts}>
        {question.options.map((option) => {
          const on = value === option.value;
          return (
            <button
              aria-pressed={on}
              className={cn(styles.opt, on && styles.on)}
              key={option.value}
              onClick={() => setAnswer(question.id, option.value)}
              type="button"
            >
              {option.icon ? (
                <span className={styles.optIco}>{QUIZ_ICON[option.icon]}</span>
              ) : (
                <ModelDot model={option.model} />
              )}
              <span className={styles.optMain}>
                <span className={styles.optLabel}>{option.label}</span>
                {option.desc && (
                  <span className={styles.optDesc}>{option.desc}</span>
                )}
              </span>
              <span className={cn(styles.optMark, styles.radio)} />
            </button>
          );
        })}
      </div>
      {selected?.withText && (
        <input
          className={cn(styles.text, styles.optOther)}
          onChange={(event) =>
            setAnswer(`${question.id}_other`, event.target.value)
          }
          placeholder={selected.textPlaceholder}
          value={
            typeof answers[`${question.id}_other`] === "string"
              ? (answers[`${question.id}_other`] as string)
              : ""
          }
        />
      )}
    </>
  );
}

function ChoiceField({
  question,
  answers,
  setAnswer,
}: {
  question: ChoiceQuestion;
  answers: QuizAnswers;
  setAnswer: SetAnswer;
}) {
  const selected = asArray(answers[question.id]);
  const { exclusiveValue } = question;

  const toggle = (value: string) => {
    if (exclusiveValue && value === exclusiveValue) {
      setAnswer(question.id, selected.includes(value) ? [] : [value]);
      return;
    }
    const cleaned = exclusiveValue
      ? selected.filter((item) => item !== exclusiveValue)
      : selected;
    setAnswer(
      question.id,
      cleaned.includes(value)
        ? cleaned.filter((item) => item !== value)
        : [...cleaned, value]
    );
  };

  if (question.type === "cards") {
    return (
      <div className={styles.cards}>
        {question.options.map((option) => {
          const on = selected.includes(option.value);
          return (
            <button
              aria-pressed={on}
              className={cn(styles.card, on && styles.on)}
              key={option.value}
              onClick={() => toggle(option.value)}
              type="button"
            >
              {option.icon && (
                <span className={styles.cardIco}>{QUIZ_ICON[option.icon]}</span>
              )}
              <span className={styles.cardLabel}>{option.label}</span>
              <span className={styles.cardTick}>{on && QUIZ_ICON.check}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={styles.opts}>
      {question.options.map((option) => {
        const on = selected.includes(option.value);
        return (
          <button
            aria-pressed={on}
            className={cn(styles.opt, on && styles.on)}
            key={option.value}
            onClick={() => toggle(option.value)}
            type="button"
          >
            {option.icon ? (
              <span className={styles.optIco}>{QUIZ_ICON[option.icon]}</span>
            ) : (
              <ModelDot model={option.model} />
            )}
            <span className={styles.optMain}>
              <span className={styles.optLabel}>{option.label}</span>
              {option.desc && (
                <span className={styles.optDesc}>{option.desc}</span>
              )}
            </span>
            <span className={cn(styles.optMark, styles.check)}>
              {on && QUIZ_ICON.check}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function RatingField({
  question,
  answers,
  setAnswer,
}: {
  question: RatingQuestion;
  answers: QuizAnswers;
  setAnswer: SetAnswer;
}) {
  const raw = answers[question.id];
  const current = typeof raw === "number" ? raw : 0;
  const stars = Array.from({ length: question.max }, (_, index) => index + 1);

  return (
    <div className={styles.rating}>
      <div className={styles.stars}>
        {stars.map((n) => (
          <button
            aria-label={String(n)}
            className={cn(styles.star, n <= current && styles.on)}
            key={`star-${n}`}
            onClick={() => setAnswer(question.id, n)}
            type="button"
          >
            {QUIZ_ICON.star}
          </button>
        ))}
      </div>
      <div className={styles.ratingLabels}>
        <span>{question.lowLabel}</span>
        <span className={styles.ratingNow}>
          {current ? `${current} / ${question.max}` : "—"}
        </span>
        <span>{question.highLabel}</span>
      </div>
    </div>
  );
}

function TextField({
  question,
  answers,
  setAnswer,
  optionalLabel,
}: {
  question: TextQuestion;
  answers: QuizAnswers;
  setAnswer: SetAnswer;
  optionalLabel: string;
}) {
  const raw = answers[question.id];
  return (
    <div className={styles.textWrap}>
      <textarea
        className={styles.text}
        onChange={(event) => setAnswer(question.id, event.target.value)}
        placeholder={question.placeholder}
        rows={3}
        value={typeof raw === "string" ? raw : ""}
      />
      {question.optional && (
        <span className={styles.textOpt}>{optionalLabel}</span>
      )}
    </div>
  );
}

export function QuizField({
  question,
  answers,
  setAnswer,
  optionalLabel,
}: QuizFieldProps) {
  if (question.type === "radio") {
    return (
      <RadioField answers={answers} question={question} setAnswer={setAnswer} />
    );
  }
  if (question.type === "checkbox" || question.type === "cards") {
    return (
      <ChoiceField
        answers={answers}
        question={question}
        setAnswer={setAnswer}
      />
    );
  }
  if (question.type === "rating") {
    return (
      <RatingField
        answers={answers}
        question={question}
        setAnswer={setAnswer}
      />
    );
  }
  if (question.type === "text") {
    return (
      <TextField
        answers={answers}
        optionalLabel={optionalLabel}
        question={question}
        setAnswer={setAnswer}
      />
    );
  }
  return null;
}
