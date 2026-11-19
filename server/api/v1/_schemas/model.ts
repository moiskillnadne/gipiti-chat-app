import { z } from "zod/v4";

import { openEnum } from "@/server/api/_kit/open-enum";

/**
 * Providers known when this version of the API was written. A unit test
 * checks the list against the model registry.
 */
export const KNOWN_MODEL_PROVIDERS = [
  "openai",
  "google",
  "anthropic",
  "xai",
  "bfl",
  "recraft",
  "klingai",
  "bytedance",
  "deepseek",
  "perplexity",
  "moonshotai",
  "alibaba",
  "meta",
  "mistral",
  "zai",
  "minimax",
  "xiaomi",
  "microsoft",
] as const;

const modelCapabilitiesSchema = z.object({
  reasoning: z.boolean(),
  attachments: z.boolean(),
  imageGeneration: z.boolean(),
  videoGeneration: z.boolean(),
  toolCalling: z.boolean(),
});

export const modelSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  provider: openEnum(KNOWN_MODEL_PROVIDERS).nullable(),
  capabilities: modelCapabilitiesSchema,
});

export const modelListSchema = z.object({
  defaultModelId: z.string(),
  items: z.array(modelSchema),
});

export type Model = z.infer<typeof modelSchema>;
export type ModelList = z.infer<typeof modelListSchema>;
