import { z } from "zod";
import { ONBOARDING_QUIZ_BONUS_MAJOR_UNITS } from "@/lib/billing/constants";
import { ONBOARDING_QUIZ_KEY } from "./types";

// Server-side definition of each reward quiz: how much it grants and how its
// answers are validated. Adding a future quiz = one more entry here plus its
// structure/i18n on the client.
export type QuizDefinition = {
  bonusMajorUnits: number;
  schema: z.ZodTypeAny;
};

const onboardingAnswersSchema = z
  .object({
    sphere: z.enum(["it", "marketing", "student", "other"]),
    sphere_other: z.string().trim().min(1).max(500).optional(),
    purpose: z.array(z.enum(["work", "study", "personal", "explore"])).min(1),
    create: z.array(z.enum(["text", "image", "code", "video"])).min(1),
    models: z.array(z.enum(["gpt", "claude", "gemini", "grok", "none"])).min(1),
    level: z.number().int().min(1).max(5),
    contacts: z.string().trim().min(1).max(500),
  })
  .refine(
    (data) =>
      data.sphere !== "other" || (data.sphere_other?.trim().length ?? 0) > 0,
    { message: "sphere_other is required", path: ["sphere_other"] }
  );

const QUIZ_REGISTRY: Record<string, QuizDefinition> = {
  [ONBOARDING_QUIZ_KEY]: {
    bonusMajorUnits: ONBOARDING_QUIZ_BONUS_MAJOR_UNITS,
    schema: onboardingAnswersSchema,
  },
};

export function getQuizDefinition(key: string): QuizDefinition | undefined {
  return QUIZ_REGISTRY[key];
}
