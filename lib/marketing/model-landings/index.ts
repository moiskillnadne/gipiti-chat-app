/**
 * Curated marketing copy for per-model landing pages under /models/{slug}.
 *
 * Landings are grouped by vendor (one module each) and aggregated here; all
 * consumers import from `@/lib/marketing/model-landings`.
 */

import { anthropicLandings } from "./anthropic";
import { deepseekLandings } from "./deepseek";
import { googleLandings } from "./google";
import { openaiLandings } from "./openai";
import { perplexityLandings } from "./perplexity";
import type { ModelLanding } from "./types";
import { xaiLandings } from "./xai";

export type {
  LandingAudienceCard,
  LandingBenefit,
  LandingBenefitIcon,
  LandingFaqItem,
  LandingHeroChat,
  LandingModelChip,
  LandingStep,
  ModelLanding,
  ModelLandingAccent,
} from "./types";

export const modelLandings: ModelLanding[] = [
  ...openaiLandings,
  ...anthropicLandings,
  ...googleLandings,
  ...perplexityLandings,
  ...xaiLandings,
  ...deepseekLandings,
];

export const getModelLandingBySlug = (slug: string): ModelLanding | undefined =>
  modelLandings.find((landing) => landing.slug === slug);

export const getModelLandingByModelId = (
  modelId: string
): ModelLanding | undefined =>
  modelLandings.find((landing) => landing.modelId === modelId);

export type EmphasisSegment = {
  id: string;
  text: string;
  isBold: boolean;
};

/**
 * Splits `**bold**` markers in landing copy into typed segments so components
 * can render emphasis without dangerouslySetInnerHTML. Odd split positions are
 * the bold runs; ids are stable per source string.
 */
export const parseEmphasis = (text: string): EmphasisSegment[] => {
  const segments: EmphasisSegment[] = [];
  let offset = 0;

  for (const [position, part] of text.split("**").entries()) {
    if (part.length > 0) {
      segments.push({
        id: `${offset}-${part.slice(0, 12)}`,
        text: part,
        isBold: position % 2 === 1,
      });
    }
    offset += part.length + 2;
  }

  return segments;
};
