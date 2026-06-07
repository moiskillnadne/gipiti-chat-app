// Shared, framework-neutral quiz types. Kept dependency-free so both the server
// (DB schema, queries, API) and the client widget can import them.

// Stable key for the post-email onboarding profiling quiz. Namespaces its
// QuizResponse row, reward transaction, and registry entry.
export const ONBOARDING_QUIZ_KEY = "onboarding";

// A single answer: one choice (radio/text), several choices (checkbox/cards),
// or a numeric value (rating).
export type QuizAnswerValue = string | string[] | number;

// The full set of answers for one quiz, keyed by question id. Free-text follow
// ups (e.g. the "other" option) are stored under their own `${id}_other` key.
export type QuizAnswers = Record<string, QuizAnswerValue>;
