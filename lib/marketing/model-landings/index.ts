/**
 * Curated marketing copy for per-model landing pages under /models/{slug}.
 *
 * Modules are grouped by vendor; image and video landings carry the modality
 * as a filename prefix (`image-*`, `video-*`) because several vendors ship
 * models in more than one category. Everything is aggregated here — all
 * consumers import from `@/lib/marketing/model-landings`.
 *
 * Every model in `models-catalog.ts` has a landing, so each catalog card links
 * to one; keep the two files in sync when a model is added or removed.
 */

import { anthropicLandings } from "./anthropic";
import { codeLandings } from "./code";
import { deepseekLandings } from "./deepseek";
import { googleLandings } from "./google";
import { bflImageLandings } from "./image-bfl";
import { bytedanceImageLandings } from "./image-bytedance";
import { googleImageLandings } from "./image-google";
import { openaiImageLandings } from "./image-openai";
import { recraftImageLandings } from "./image-recraft";
import { xaiImageLandings } from "./image-xai";
import { openaiLandings } from "./openai";
import { perplexityLandings } from "./perplexity";
import type { ModelLanding } from "./types";
import { bytedanceVideoLandings } from "./video-bytedance";
import { googleVideoLandings } from "./video-google";
import { klingaiVideoLandings } from "./video-klingai";
import { xaiVideoLandings } from "./video-xai";
import { xaiLandings } from "./xai";

export { sectionCopy } from "./shared";
export type {
  LandingAudienceCard,
  LandingBenefit,
  LandingBenefitIcon,
  LandingFaqItem,
  LandingHeroChat,
  LandingHeroMedia,
  LandingKind,
  LandingMediaAspect,
  LandingModelChip,
  LandingStep,
  MediaModelLanding,
  ModelLanding,
  ModelLandingAccent,
  TextModelLanding,
} from "./types";

export const modelLandings: ModelLanding[] = [
  ...openaiLandings,
  ...anthropicLandings,
  ...googleLandings,
  ...perplexityLandings,
  ...xaiLandings,
  ...deepseekLandings,
  ...codeLandings,
  ...googleImageLandings,
  ...openaiImageLandings,
  ...bflImageLandings,
  ...recraftImageLandings,
  ...xaiImageLandings,
  ...bytedanceImageLandings,
  ...googleVideoLandings,
  ...klingaiVideoLandings,
  ...bytedanceVideoLandings,
  ...xaiVideoLandings,
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
