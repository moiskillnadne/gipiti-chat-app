import { z } from "zod/v4";

import { openEnum } from "@/server/api/_kit/open-enum";
import { moneySchema } from "@/server/api/v1/_schemas/money";

const MAX_QUIZ_KEY_LENGTH = 64;

/** `data.reason` of a 403 from the quiz endpoints. */
export const KNOWN_QUIZ_FORBIDDEN_REASONS = [
  "email_not_verified",
  "cross_site_request",
] as const;

/** `data.reason` of a 400 from the quiz endpoints. */
export const KNOWN_QUIZ_BAD_REQUEST_REASONS = ["invalid_answers"] as const;

export const quizForbiddenDataSchema = z.object({
  reason: openEnum(KNOWN_QUIZ_FORBIDDEN_REASONS),
});

export const quizBadRequestDataSchema = z.object({
  reason: openEnum(KNOWN_QUIZ_BAD_REQUEST_REASONS),
});

export const quizKeyInputSchema = z.object({
  quizKey: z.string().min(1).max(MAX_QUIZ_KEY_LENGTH),
});

export const quizCompletionSchema = z.object({
  completed: z.boolean().meta({
    description: "The user has already saved answers to this quiz.",
  }),
});

export const submitQuizInputSchema = quizKeyInputSchema.extend({
  answers: z.record(z.string(), z.unknown()).meta({
    description:
      "The answers by question id. Their shape is the quiz's own; wrong answers are refused with 400 `invalid_answers`.",
  }),
});

export const submitQuizOutputSchema = z.object({
  completed: z.boolean(),
  bonusGranted: z.boolean().meta({
    description: "The bonus was credited by this call.",
  }),
  bonus: moneySchema.nullable().meta({
    description:
      "What this call credited; null when nothing was credited now (the bonus was paid before).",
  }),
});

export type SubmitQuizOutput = z.infer<typeof submitQuizOutputSchema>;
