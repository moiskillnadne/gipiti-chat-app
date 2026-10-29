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
  /**
   * Provider cost the gateway reported for the text steps (USD), from
   * `sumGatewayCostUsd`. When present it is what gets billed: it is what the
   * owner actually pays (cache reads, off-peak rates and real list prices
   * included). TokenLens is only the fallback for turns without it. Probed
   * 2026-10-29: TokenLens billed 2x the gateway cost on mistral-large-4 and
   * deepseek-v4.1-flash-1017, ~0.57x on glm-5.3, and charged cache reads at
   * the full input rate (5.8x on minimax-m3.1-flash).
   */
  gatewayCostUsd?: number;
};

/**
 * Sum the gateway-reported USD cost over the steps of a text turn. Returns
 * undefined when no step carried a usable cost.
 */
export function sumGatewayCostUsd(
  steps: ReadonlyArray<{ providerMetadata?: unknown }>
): number | undefined {
  let total = 0;
  let found = false;
  for (const step of steps) {
    const gateway = (
      step.providerMetadata as Record<string, unknown> | undefined
    )?.gateway as Record<string, unknown> | undefined;
    const cost = gateway?.cost;
    const parsed = cost == null ? Number.NaN : Number.parseFloat(String(cost));
    if (Number.isFinite(parsed) && parsed > 0) {
      total += parsed;
      found = true;
    }
  }
  return found ? total : undefined;
}

/**
 * Resolve the TokenLens usage summary for a gateway model id, working around a
 * catalog collision: models.dev ships a "vercel" provider mirror whose model
 * keys are literally "provider/model" (e.g. "perplexity/sonar") but carry no
 * cost data. TokenLens matches gateway ids against that mirror first, yielding
 * an empty costUSD — and a $0 charge. When that happens, retry with the
 * canonical "provider:model" form, which resolves against the real provider
 * entry and its pricing.
 */
function resolveUsageSummary({
  modelId,
  usage,
  catalog,
}: {
  modelId: string;
  usage: LanguageModelUsage;
  catalog: ModelCatalog;
}): ReturnType<typeof getUsage> {
  const summary = getUsage({ modelId, usage, providers: catalog });

  if (summary.costUSD?.totalUSD !== undefined || !modelId.includes("/")) {
    return summary;
  }

  const canonical = getUsage({
    modelId: modelId.replace("/", ":"),
    usage,
    providers: catalog,
  });

  return canonical.costUSD?.totalUSD === undefined ? summary : canonical;
}

/**
 * Merge raw model usage with image-tool usage and cost enrichment.
 *
 * - missing modelId → token-count merge only (no cost fields)
 * - otherwise → spread the TokenLens summary (when a catalog is available),
 *   merge the image accumulator's tokens into the token totals, and set
 *   `costUSD.totalUSD` — the field both `usageChargeUsd` (billing) and the UI
 *   read — to the text cost (gateway cost when reported, else the TokenLens
 *   price) plus the image accumulator's provider cost. Without the latter the
 *   in-chat `generateImage` tool cost is never charged. A missing catalog (cold
 *   instance whose models.dev fetch failed) no longer zeroes the charge: the
 *   gateway and image-tool costs are still billed. The per-part
 *   `inputUSD`/`outputUSD` stay TokenLens figures (absent without a catalog).
 */
export function mergeUsage({
  usage,
  accumulator,
  modelId,
  catalog,
  gatewayCostUsd,
}: MergeUsageInput): AppUsage {
  const mergedInputTokens =
    (usage.inputTokens ?? 0) + accumulator.totalInputTokens;
  const mergedOutputTokens =
    (usage.outputTokens ?? 0) + accumulator.totalOutputTokens;

  if (!modelId) {
    return {
      ...usage,
      inputTokens: mergedInputTokens,
      outputTokens: mergedOutputTokens,
    } as AppUsage;
  }

  const summary = catalog
    ? resolveUsageSummary({ modelId, usage, catalog })
    : undefined;
  const catalogTotalUsd = summary?.costUSD?.totalUSD;
  // Gateway cost first (what the owner pays), TokenLens as the fallback.
  const chatTotalUsd = gatewayCostUsd ?? catalogTotalUsd ?? 0;
  if (gatewayCostUsd === undefined && !catalogTotalUsd) {
    console.warn(
      "[ALARM-USAGE]No gateway cost and no TokenLens price, text billed $0",
      { modelId, hasCatalog: catalog !== undefined }
    );
  }

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
      ...summary?.costUSD,
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
