import type { LanguageModelUsage } from "ai";
import type { ModelCatalog } from "tokenlens/core";
import { describe, expect, it, vi } from "vitest";
import type { ImageGenerationUsageAccumulator } from "@/lib/ai/tools/generate-image";

// Mock TokenLens cost enrichment so the test doesn't depend on a real catalog.
// getUsage() prices only the chat model's text tokens — it never knows about
// the image-tool cost, which is exactly why mergeUsage must fold that in itself.
const CHAT_TOTAL_USD = 0.02;

vi.mock("tokenlens/helpers", () => ({
  getUsage: () => ({
    costUSD: {
      totalUSD: CHAT_TOTAL_USD,
      inputUSD: 0.012,
      outputUSD: 0.008,
    },
  }),
}));

// Imported after the mock is registered so usage.ts picks up the mocked getUsage.
const { mergeUsage, usageChargeUsd } = await import("../usage");

const FAKE_CATALOG = {} as ModelCatalog;
const MODEL_ID = "gpt-5.4-mini";

function buildUsage(): LanguageModelUsage {
  return {
    inputTokens: 100,
    outputTokens: 50,
    totalTokens: 150,
  } as LanguageModelUsage;
}

function buildAccumulator(
  overrides: Partial<ImageGenerationUsageAccumulator> = {}
): ImageGenerationUsageAccumulator {
  return {
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCost: 0,
    generationCount: 0,
    ...overrides,
  };
}

describe("mergeUsage", () => {
  it("folds the in-chat image-tool cost into the charged total (regression: GIPITI-89)", () => {
    const imageCostUsd = 0.05;
    const accumulator = buildAccumulator({
      totalInputTokens: 10,
      totalOutputTokens: 20,
      totalCost: imageCostUsd,
      generationCount: 1,
    });

    const merged = mergeUsage({
      usage: buildUsage(),
      accumulator,
      modelId: MODEL_ID,
      catalog: FAKE_CATALOG,
    });

    const expectedTotal = CHAT_TOTAL_USD + imageCostUsd;
    expect(merged.costUSD?.totalUSD).toBeCloseTo(expectedTotal);
    // The billing path reads costUSD.totalUSD; it must include the image cost.
    expect(usageChargeUsd(merged)).toBeCloseTo(expectedTotal);
  });

  it("leaves the total at the chat cost when no image was generated", () => {
    const merged = mergeUsage({
      usage: buildUsage(),
      accumulator: buildAccumulator(),
      modelId: MODEL_ID,
      catalog: FAKE_CATALOG,
    });

    expect(merged.costUSD?.totalUSD).toBeCloseTo(CHAT_TOTAL_USD);
    expect(usageChargeUsd(merged)).toBeCloseTo(CHAT_TOTAL_USD);
  });

  it("merges image token counts into the token totals", () => {
    const merged = mergeUsage({
      usage: buildUsage(),
      accumulator: buildAccumulator({
        totalInputTokens: 10,
        totalOutputTokens: 20,
      }),
      modelId: MODEL_ID,
      catalog: FAKE_CATALOG,
    });

    expect(merged.inputTokens).toBe(110);
    expect(merged.outputTokens).toBe(70);
  });

  it("returns a token-only merge with no cost when modelId/catalog are absent", () => {
    const merged = mergeUsage({
      usage: buildUsage(),
      accumulator: buildAccumulator({ totalCost: 0.05 }),
      modelId: undefined,
      catalog: undefined,
    });

    expect(merged.costUSD).toBeUndefined();
    expect(usageChargeUsd(merged)).toBe(0);
  });
});
