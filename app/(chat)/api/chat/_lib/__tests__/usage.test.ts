import type { LanguageModelUsage } from "ai";
import type { ModelCatalog } from "tokenlens/core";
import { describe, expect, it, vi } from "vitest";
import type { ImageGenerationUsageAccumulator } from "@/lib/ai/tools/generate-image";

// Mock TokenLens cost enrichment so the test doesn't depend on a real catalog.
// getUsage() prices only the chat model's text tokens — it never knows about
// the image-tool cost, which is exactly why mergeUsage must fold that in itself.
const CHAT_TOTAL_USD = 0.02;
const SONAR_TOTAL_USD = 0.11;

vi.mock("tokenlens/helpers", () => ({
  getUsage: ({ modelId }: { modelId: string }) => {
    // Reproduce the models.dev "vercel" mirror collision: the slash-form
    // gateway id matches a mirror entry without cost data, while the
    // canonical provider:model form resolves to the real pricing.
    // A model missing from the catalog under both id forms: no cost at all.
    if (modelId.startsWith("unknown")) {
      return { costUSD: {} };
    }
    if (modelId === "perplexity/sonar") {
      return { costUSD: {} };
    }
    if (modelId === "perplexity:sonar") {
      return {
        costUSD: {
          totalUSD: SONAR_TOTAL_USD,
          inputUSD: 0.1,
          outputUSD: 0.01,
        },
      };
    }
    return {
      costUSD: {
        totalUSD: CHAT_TOTAL_USD,
        inputUSD: 0.012,
        outputUSD: 0.008,
      },
    };
  },
}));

// Imported after the mock is registered so usage.ts picks up the mocked getUsage.
const { mergeUsage, sumGatewayCostUsd, usageChargeUsd } = await import(
  "../usage"
);

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

  it("falls back to the canonical provider:model id when the gateway id resolves without cost", () => {
    const merged = mergeUsage({
      usage: buildUsage(),
      accumulator: buildAccumulator(),
      modelId: "perplexity/sonar",
      catalog: FAKE_CATALOG,
    });

    expect(merged.costUSD?.totalUSD).toBeCloseTo(SONAR_TOTAL_USD);
    expect(usageChargeUsd(merged)).toBeCloseTo(SONAR_TOTAL_USD);
  });

  it("bills the gateway cost when the catalog has no price for the model", () => {
    const merged = mergeUsage({
      usage: buildUsage(),
      accumulator: buildAccumulator(),
      modelId: "unknown/not-in-catalog",
      catalog: FAKE_CATALOG,
      gatewayCostUsd: 0.07,
    });

    expect(usageChargeUsd(merged)).toBeCloseTo(0.07);
  });

  it("bills the gateway cost over the catalog price when both exist", () => {
    const merged = mergeUsage({
      usage: buildUsage(),
      accumulator: buildAccumulator(),
      modelId: MODEL_ID,
      catalog: FAKE_CATALOG,
      gatewayCostUsd: 0.035,
    });

    expect(usageChargeUsd(merged)).toBeCloseTo(0.035);
  });

  it("bills the gateway cost even when it is below the catalog price", () => {
    const merged = mergeUsage({
      usage: buildUsage(),
      accumulator: buildAccumulator(),
      modelId: MODEL_ID,
      catalog: FAKE_CATALOG,
      gatewayCostUsd: 0.005,
    });

    expect(usageChargeUsd(merged)).toBeCloseTo(0.005);
  });

  it("falls back to the catalog price when the gateway reported no cost", () => {
    const merged = mergeUsage({
      usage: buildUsage(),
      accumulator: buildAccumulator(),
      modelId: MODEL_ID,
      catalog: FAKE_CATALOG,
      gatewayCostUsd: undefined,
    });

    expect(usageChargeUsd(merged)).toBeCloseTo(CHAT_TOTAL_USD);
  });

  it("bills $0 for the text when neither the gateway nor the catalog has a cost", () => {
    const merged = mergeUsage({
      usage: buildUsage(),
      accumulator: buildAccumulator(),
      modelId: "unknown/not-in-catalog",
      catalog: FAKE_CATALOG,
    });

    expect(usageChargeUsd(merged)).toBe(0);
  });

  it("adds the image-tool cost on top of the gateway text cost", () => {
    const merged = mergeUsage({
      usage: buildUsage(),
      accumulator: buildAccumulator({ totalCost: 0.04, generationCount: 1 }),
      modelId: MODEL_ID,
      catalog: FAKE_CATALOG,
      gatewayCostUsd: 0.01,
    });

    expect(usageChargeUsd(merged)).toBeCloseTo(0.05);
  });

  it("sums per-step gateway costs and ignores steps without one", () => {
    expect(
      sumGatewayCostUsd([
        { providerMetadata: { gateway: { cost: "0.01" } } },
        { providerMetadata: undefined },
        { providerMetadata: { gateway: { cost: "0.02" } } },
      ])
    ).toBeCloseTo(0.03);
    expect(sumGatewayCostUsd([{ providerMetadata: {} }])).toBeUndefined();
  });

  it("bills the gateway and image-tool costs when the TokenLens catalog is unavailable", () => {
    const merged = mergeUsage({
      usage: buildUsage(),
      accumulator: buildAccumulator({ totalCost: 0.04, generationCount: 1 }),
      modelId: MODEL_ID,
      catalog: undefined,
      gatewayCostUsd: 0.01,
    });

    expect(usageChargeUsd(merged)).toBeCloseTo(0.05);
    expect(merged.modelId).toBe(MODEL_ID);
  });

  it("bills $0 without a catalog when the gateway reported no cost", () => {
    const merged = mergeUsage({
      usage: buildUsage(),
      accumulator: buildAccumulator(),
      modelId: MODEL_ID,
      catalog: undefined,
    });

    expect(usageChargeUsd(merged)).toBe(0);
  });

  it("returns a token-only merge with no cost when modelId is absent", () => {
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
