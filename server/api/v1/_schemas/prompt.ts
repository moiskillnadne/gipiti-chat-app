import { z } from "zod/v4";

import { openEnum } from "@/server/api/_kit/open-enum";

/**
 * The categories of the prompt catalogue today (`lib/prompts/prompt-meta.ts`
 * holds the same list for the web; a test keeps the two equal). New ones may
 * come with a catalogue update, so clients must accept other values.
 */
export const KNOWN_PROMPT_CATEGORIES = [
  "text",
  "code",
  "image",
  "video",
  "research",
  "marketing",
  "learning",
  "productivity",
  "life",
] as const;

export const promptSchema = z.object({
  id: z.string(),
  key: z.string().meta({
    description:
      "Stable identifier from the curated catalogue, for example `t1`.",
  }),
  category: openEnum(KNOWN_PROMPT_CATEGORIES),
  modelId: z.string().meta({
    description:
      "The model the prompt is written for (an id from `GET /models`).",
  }),
  title: z.string(),
  body: z.string(),
  tags: z.array(z.string()),
});

export type PromptDto = z.infer<typeof promptSchema>;

export const promptListSchema = z.object({ items: z.array(promptSchema) });

export const favoritePromptListSchema = z.object({
  items: z.array(z.object({ promptId: z.string() })),
});

export const promptIdInputSchema = z.object({ promptId: z.uuid() });
