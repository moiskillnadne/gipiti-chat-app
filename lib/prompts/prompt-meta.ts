import { getModelById, type ModelProvider } from "@/lib/ai/models";

export type PromptCategoryId =
  | "text"
  | "code"
  | "image"
  | "video"
  | "research"
  | "marketing"
  | "learning"
  | "productivity"
  | "life";

export type PromptCategory = {
  id: PromptCategoryId;
  /** Key inside the `promptLibrary` i18n namespace. */
  labelKey: string;
  /** oklch dot color (from the design's `--c-*` tokens). */
  color: string;
};

// Category hues — ported from the design's `--c-*` CSS variables.
export const PROMPT_CATEGORIES: readonly PromptCategory[] = [
  { id: "text", labelKey: "categoryText", color: "oklch(0.66 0.15 60)" },
  { id: "code", labelKey: "categoryCode", color: "oklch(0.62 0.14 150)" },
  { id: "image", labelKey: "categoryImage", color: "oklch(0.64 0.16 330)" },
  { id: "video", labelKey: "categoryVideo", color: "oklch(0.58 0.16 285)" },
  {
    id: "research",
    labelKey: "categoryResearch",
    color: "oklch(0.58 0.14 245)",
  },
  {
    id: "marketing",
    labelKey: "categoryMarketing",
    color: "oklch(0.62 0.18 30)",
  },
  {
    id: "learning",
    labelKey: "categoryLearning",
    color: "oklch(0.62 0.12 195)",
  },
  {
    id: "productivity",
    labelKey: "categoryProductivity",
    color: "oklch(0.62 0.14 110)",
  },
  { id: "life", labelKey: "categoryLife", color: "oklch(0.66 0.13 350)" },
] as const;

const CATEGORY_BY_ID: Record<string, PromptCategory> = Object.fromEntries(
  PROMPT_CATEGORIES.map((category) => [category.id, category])
);

export function getPromptCategory(id: string): PromptCategory | undefined {
  return CATEGORY_BY_ID[id];
}

// Provider dot colors — ported from the design's `--p-*` CSS variables.
const PROVIDER_COLORS: Record<ModelProvider, string> = {
  openai: "oklch(0.55 0.15 155)",
  anthropic: "oklch(0.62 0.16 60)",
  google: "oklch(0.58 0.13 245)",
  xai: "oklch(0.45 0.05 285)",
  bfl: "oklch(0.55 0.16 25)",
  recraft: "oklch(0.55 0.14 320)",
};

const FALLBACK_PROVIDER_COLOR = "var(--ink-4)";

export type PromptModelMeta = {
  name: string;
  description: string;
  color: string;
};

/**
 * Resolves a prompt's recommended model id against the live model registry,
 * returning the display name, description, and a provider dot color. Falls back
 * gracefully when a model id is no longer present in the registry.
 */
export function getPromptModelMeta(modelId: string): PromptModelMeta {
  const model = getModelById(modelId);
  const color = model?.provider
    ? PROVIDER_COLORS[model.provider]
    : FALLBACK_PROVIDER_COLOR;

  return {
    name: model?.name ?? modelId,
    description: model?.description ?? "",
    color,
  };
}
