import type { LanguageModelUsage } from "ai";
import { unstable_cache as cache } from "next/cache";
import type { ModelCatalog } from "tokenlens/core";
import { fetchModels } from "tokenlens/fetch";
import { getUsage } from "tokenlens/helpers";
import type { ImageGenerationUsageAccumulator } from "@/lib/ai/tools/generate-image";
import type { AppUsage } from "@/lib/usage";

/**
 * Fetch the TokenLens model catalog (cached 24h). Returns undefined on failure
 * so TokenLens helpers fall back to their bundled default catalog.
 */
export const getTokenlensCatalog = cache(
  async (): Promise<ModelCatalog | undefined> => {
    try {
      return await fetchModels();
    } catch (err) {
      console.warn(
        "TokenLens: catalog fetch failed, using default catalog",
        err
      );
      return; // tokenlens helpers will fall back to defaultCatalog
    }
  },
  ["tokenlens-catalog"],
  { revalidate: 24 * 60 * 60 } // 24 hours
);

type MergeUsageInput = {
  usage: LanguageModelUsage;
  accumulator: ImageGenerationUsageAccumulator;
  modelId: string | undefined;
  catalog: ModelCatalog | undefined;
};

/**
 * Merge raw model usage with image-tool usage and (when both a resolved modelId
 * and a catalog are available) TokenLens cost enrichment.
 *
 * Mirrors the previous inline onFinish behavior exactly:
 * - missing modelId or catalog → token-count merge only (no cost fields)
 * - otherwise → spread the TokenLens summary and fold the image accumulator's
 *   tokens and cost into the totals.
 */
export function mergeUsage({
  usage,
  accumulator,
  modelId,
  catalog,
}: MergeUsageInput): AppUsage {
  const mergedInputTokens =
    (usage.inputTokens ?? 0) + accumulator.totalInputTokens;
  const mergedOutputTokens =
    (usage.outputTokens ?? 0) + accumulator.totalOutputTokens;

  if (!(modelId && catalog)) {
    return {
      ...usage,
      inputTokens: mergedInputTokens,
      outputTokens: mergedOutputTokens,
    } as AppUsage;
  }

  const summary = getUsage({ modelId, usage, providers: catalog });
  const baseCost =
    ((summary as AppUsage).inputCost ?? 0) +
    ((summary as AppUsage).outputCost ?? 0);

  return {
    ...usage,
    ...summary,
    modelId,
    inputTokens: mergedInputTokens,
    outputTokens: mergedOutputTokens,
    inputCost: baseCost + accumulator.totalCost,
  } as AppUsage;
}

/**
 * The USD amount to charge for a merged usage record: inputCost + outputCost.
 * Matches the previous inline charge computation exactly.
 */
export function usageChargeUsd(usage: AppUsage): number {
  return (usage.inputCost ?? 0) + (usage.outputCost ?? 0);
}
