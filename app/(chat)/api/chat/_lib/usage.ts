import type { LanguageModelUsage } from "ai";
import type { ModelCatalog } from "tokenlens/core";
import { fetchModels } from "tokenlens/fetch";
import { getUsage } from "tokenlens/helpers";
import type { ImageGenerationUsageAccumulator } from "@/lib/ai/tools/generate-image";
import type { AppUsage } from "@/lib/usage";

const CATALOG_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Module-scoped in-memory cache shared across requests on the same instance.
// The catalog (~2.4MB from models.dev) exceeds the 2MB per-entry limit of the
// Next.js data cache (`unstable_cache`/`use cache`), so it cannot be persisted
// there — attempting to do so throws "items over 2MB can not be cached" and
// breaks the onFinish charging flow. An in-memory cache sidesteps that limit.
let cachedCatalog: ModelCatalog | undefined;
let catalogFetchedAt = 0;
let inflightCatalogFetch: Promise<ModelCatalog | undefined> | undefined;

/**
 * Fetch the catalog from the network and refresh the module-scoped cache. On
 * failure, the last successful catalog is served (or undefined if none yet) so
 * tokenlens helpers fall back to their bundled defaultCatalog.
 */
async function fetchAndCacheCatalog(): Promise<ModelCatalog | undefined> {
  try {
    const catalog = await fetchModels();
    cachedCatalog = catalog;
    catalogFetchedAt = Date.now();
    return catalog;
  } catch (err) {
    console.warn(
      "TokenLens: catalog fetch failed, using cached or default catalog",
      err
    );
    return cachedCatalog;
  } finally {
    inflightCatalogFetch = undefined;
  }
}

/**
 * Fetch the TokenLens model catalog (cached 24h in memory). Concurrent refreshes
 * are coalesced into a single network call, and a stale catalog is served if a
 * refresh fails. Returns undefined only when no catalog has ever been fetched
 * successfully, so TokenLens helpers fall back to their bundled default catalog.
 */
export async function getTokenlensCatalog(): Promise<ModelCatalog | undefined> {
  const isFresh =
    cachedCatalog !== undefined &&
    Date.now() - catalogFetchedAt < CATALOG_TTL_MS;

  if (isFresh) {
    return cachedCatalog;
  }

  if (!inflightCatalogFetch) {
    inflightCatalogFetch = fetchAndCacheCatalog();
  }

  return await inflightCatalogFetch;
}

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
 * - missing modelId or catalog → token-count merge only (no cost fields)
 * - otherwise → spread the TokenLens summary, merge the image accumulator's
 *   tokens into the token totals, and fold its provider cost into
 *   `costUSD.totalUSD` — the field both `usageChargeUsd` (billing) and the UI
 *   read. Without this the in-chat `generateImage` tool cost is never charged.
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
  const chatTotalUsd = summary.costUSD?.totalUSD ?? 0;

  return {
    ...usage,
    ...summary,
    modelId,
    inputTokens: mergedInputTokens,
    outputTokens: mergedOutputTokens,
    // Fold the in-chat image-tool provider cost into the charged/displayed
    // total. usageChargeUsd() and the UI both read costUSD.totalUSD, so the
    // accumulated image cost must land here — the previous `inputCost` field
    // was read by nothing, so that cost was silently dropped from billing.
    costUSD: {
      ...summary.costUSD,
      totalUSD: chatTotalUsd + accumulator.totalCost,
    },
  } as AppUsage;
}

/**
 * The USD amount to charge for a merged usage record: inputCost + outputCost.
 * Matches the previous inline charge computation exactly.
 */
export function usageChargeUsd(usage: AppUsage): number {
  const totalUSD = usage.costUSD?.totalUSD;

  if (!totalUSD) {
    console.warn("[ALARM-USAGE]No totalUSD found in usage", usage);
    return 0;
  }

  return totalUSD;
}
