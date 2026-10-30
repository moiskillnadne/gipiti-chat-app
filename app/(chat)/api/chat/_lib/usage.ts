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

// --- Aborted turns (user pressed Stop) --------------------------------------
//
// On abort the AI SDK reports usage only for FINISHED steps; the running step
// has no usage at all. We bill finished steps at their real cost and add an
// estimate for what the running step produced up to the stop.

const CYRILLIC_CHARS_PER_TOKEN = 2.5;
const OTHER_CHARS_PER_TOKEN = 4;
const CYRILLIC_FIRST = 0x04_00;
const CYRILLIC_LAST = 0x04_ff;

/**
 * Rough token estimate from characters (no tokenizer is installed): Cyrillic
 * costs ~2.5 chars/token, everything else ~4. Only used to bill the step that
 * was cut off by a stop, never for completed steps.
 */
export function estimateTokens(text: string): number {
  if (!text) {
    return 0;
  }

  let cyrillic = 0;
  let other = 0;
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code >= CYRILLIC_FIRST && code <= CYRILLIC_LAST) {
      cyrillic += 1;
    } else {
      other += 1;
    }
  }

  return Math.ceil(
    cyrillic / CYRILLIC_CHARS_PER_TOKEN + other / OTHER_CHARS_PER_TOKEN
  );
}

/** The subset of a `streamText` `onChunk` chunk the tracker reads. */
type InFlightChunk = { type: string; text?: string; delta?: string };

export type InFlightStepTracker = {
  /** Feed every `onChunk` chunk. Synchronous: a returned promise pauses the stream. */
  onChunk: (chunk: InFlightChunk) => void;
  /** Forget the running step (call from `onStepFinish`). */
  reset: () => void;
  /** Everything the running step has generated so far (text, reasoning, tool input). */
  outputText: () => string;
};

/**
 * Accumulates what the currently running step has streamed so far, so that a
 * stop in the middle of a step can still be billed for its output.
 */
export function createInFlightStepTracker(): InFlightStepTracker {
  let pieces: string[] = [];

  return {
    onChunk(chunk) {
      switch (chunk.type) {
        case "text-delta":
        case "reasoning-delta":
          if (chunk.text) {
            pieces.push(chunk.text);
          }
          break;
        case "tool-input-delta":
          if (chunk.delta) {
            pieces.push(chunk.delta);
          }
          break;
        default:
          break;
      }
    },
    reset() {
      pieces = [];
    },
    outputText() {
      return pieces.join("");
    },
  };
}

/**
 * TokenLens price (USD) for a usage record, or undefined when the model has no
 * price in the catalog (or there is no catalog at all).
 */
export function priceUsageUsd({
  modelId,
  usage,
  catalog,
}: {
  modelId: string;
  usage: LanguageModelUsage;
  catalog: ModelCatalog | undefined;
}): number | undefined {
  if (!catalog) {
    return;
  }
  const totalUsd = resolveUsageSummary({ modelId, usage, catalog }).costUSD
    ?.totalUSD;
  return totalUsd && totalUsd > 0 ? totalUsd : undefined;
}

/** The slice of a finished `StepResult` that abort billing needs. */
export type AbortedTurnStep = {
  usage: LanguageModelUsage;
  finishReason?: string;
  providerMetadata?: unknown;
  toolResults?: readonly { output?: unknown }[];
};

const sumDefined = (
  ...values: Array<number | undefined>
): number | undefined =>
  values.some((value) => value !== undefined)
    ? values.reduce<number>((total, value) => total + (value ?? 0), 0)
    : undefined;

/** Sum the usage of finished steps into one `LanguageModelUsage`. */
function sumStepUsage(steps: readonly AbortedTurnStep[]): LanguageModelUsage {
  const total: LanguageModelUsage = {
    inputTokens: undefined,
    inputTokenDetails: {
      noCacheTokens: undefined,
      cacheReadTokens: undefined,
      cacheWriteTokens: undefined,
    },
    outputTokens: undefined,
    outputTokenDetails: { textTokens: undefined, reasoningTokens: undefined },
    totalTokens: undefined,
  };

  for (const { usage } of steps) {
    total.inputTokens = sumDefined(total.inputTokens, usage.inputTokens);
    total.outputTokens = sumDefined(total.outputTokens, usage.outputTokens);
    total.totalTokens = sumDefined(total.totalTokens, usage.totalTokens);
    total.inputTokenDetails = {
      noCacheTokens: sumDefined(
        total.inputTokenDetails.noCacheTokens,
        usage.inputTokenDetails?.noCacheTokens
      ),
      cacheReadTokens: sumDefined(
        total.inputTokenDetails.cacheReadTokens,
        usage.inputTokenDetails?.cacheReadTokens
      ),
      cacheWriteTokens: sumDefined(
        total.inputTokenDetails.cacheWriteTokens,
        usage.inputTokenDetails?.cacheWriteTokens
      ),
    };
    total.outputTokenDetails = {
      textTokens: sumDefined(
        total.outputTokenDetails.textTokens,
        usage.outputTokenDetails?.textTokens
      ),
      reasoningTokens: sumDefined(
        total.outputTokenDetails.reasoningTokens,
        usage.outputTokenDetails?.reasoningTokens
      ),
    };
  }

  total.reasoningTokens = total.outputTokenDetails.reasoningTokens;
  total.cachedInputTokens = total.inputTokenDetails.cacheReadTokens;
  return total;
}

/**
 * A step that ended for one of these reasons was the model's last: no further
 * step can have been running when the stop landed.
 */
const TERMINAL_FINISH_REASONS = new Set(["stop", "length", "content-filter"]);

/** Rough token size of the tool outputs the next step would be fed. */
function estimateToolResultTokens(step: AbortedTurnStep): number {
  let tokens = 0;
  for (const result of step.toolResults ?? []) {
    try {
      tokens += estimateTokens(JSON.stringify(result.output) ?? "");
    } catch {
      // Unserializable output: skip, this is only an estimate.
    }
  }
  return tokens;
}

type AbortedTurnUsageInput = {
  /** Steps that finished before the stop (`onAbort` / `onFinish` `steps`). */
  steps: readonly AbortedTurnStep[];
  /** Output generated by the step that was running when the stop landed. */
  inFlightOutputText: string;
  /** Text sent to the model for the first step (system prompt + history). */
  promptText: string;
  accumulator: ImageGenerationUsageAccumulator;
  modelId: string;
  catalog: ModelCatalog | undefined;
};

/**
 * Usage record for a turn the user stopped. Finished steps are billed at the
 * gateway-reported cost (TokenLens as the fallback); the running step is
 * estimated from characters and priced with TokenLens. If the running step
 * cannot be priced, only the finished steps are charged (and it is logged).
 */
export function computeAbortedTurnUsage({
  steps,
  inFlightOutputText,
  promptText,
  accumulator,
  modelId,
  catalog,
}: AbortedTurnUsageInput): AppUsage {
  const finishedUsage = sumStepUsage(steps);
  const finishedUsd =
    sumGatewayCostUsd(steps) ??
    (steps.length > 0
      ? priceUsageUsd({ modelId, usage: finishedUsage, catalog })
      : undefined);

  const lastStep = steps.at(-1);
  // The stop can land right after the model's final step (or after the turn
  // fully completed): then nothing was running and there is nothing to estimate.
  const hasRunningStep =
    lastStep === undefined ||
    inFlightOutputText !== "" ||
    !TERMINAL_FINISH_REASONS.has(lastStep.finishReason ?? "");

  const runningInputTokens = (() => {
    if (!hasRunningStep) {
      return 0;
    }
    return lastStep
      ? (lastStep.usage.inputTokens ?? 0) +
          (lastStep.usage.outputTokens ?? 0) +
          estimateToolResultTokens(lastStep)
      : estimateTokens(promptText);
  })();
  const runningOutputTokens = estimateTokens(inFlightOutputText);
  const runningUsage = {
    inputTokens: runningInputTokens,
    outputTokens: runningOutputTokens,
    totalTokens: runningInputTokens + runningOutputTokens,
    inputTokenDetails: {
      noCacheTokens: runningInputTokens,
      cacheReadTokens: undefined,
      cacheWriteTokens: undefined,
    },
    outputTokenDetails: {
      textTokens: runningOutputTokens,
      reasoningTokens: undefined,
    },
  } satisfies LanguageModelUsage;
  const runningUsd = hasRunningStep
    ? priceUsageUsd({ modelId, usage: runningUsage, catalog })
    : 0;

  if (runningUsd === undefined) {
    console.warn("[ALARM-USAGE] aborted step unpriced", {
      modelId,
      hasCatalog: catalog !== undefined,
      finishedSteps: steps.length,
      runningInputTokens,
      runningOutputTokens,
    });
  }

  const totalUsd = (finishedUsd ?? 0) + (runningUsd ?? 0);
  // Token counts: finished steps exactly, plus the running step only when it
  // was priced, so the displayed tokens match what was charged.
  const usage: LanguageModelUsage =
    runningUsd === undefined
      ? finishedUsage
      : {
          ...finishedUsage,
          inputTokens: (finishedUsage.inputTokens ?? 0) + runningInputTokens,
          outputTokens: (finishedUsage.outputTokens ?? 0) + runningOutputTokens,
          totalTokens:
            (finishedUsage.totalTokens ?? 0) +
            runningInputTokens +
            runningOutputTokens,
        };

  return mergeUsage({
    usage,
    accumulator,
    modelId,
    catalog,
    gatewayCostUsd: totalUsd > 0 ? totalUsd : undefined,
  });
}
