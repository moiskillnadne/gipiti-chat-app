import { z } from "zod/v4";

import { moneySchema } from "@/server/api/v1/_schemas/money";

/**
 * Version gates for one native platform. All null until the app ships and the
 * values are configured; a client treats null as "no requirement".
 */
const clientVersionsSchema = z.object({
  minSupportedVersion: z.string().nullable(),
  latestVersion: z.string().nullable(),
  updateUrl: z.string().nullable(),
});

/** Settings that are the same for every caller. */
export const configSchema = z.object({
  clients: z.object({
    ios: clientVersionsSchema,
    android: clientVersionsSchema,
  }),
  features: z.object({
    signup: z.boolean().meta({ description: "New accounts can be created." }),
  }),
  bonuses: z.object({
    welcome: moneySchema,
    emailConfirm: moneySchema,
    onboardingQuiz: moneySchema,
  }),
  topup: z.object({
    minimum: moneySchema,
    maximum: moneySchema,
    presets: z.array(moneySchema),
  }),
});

export type Config = z.infer<typeof configSchema>;
