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
const {
  computeAbortedTurnUsage,
  computeErroredTurnUsage,
  createInFlightStepTracker,
  estimateTokens,
  mergeUsage,
  priceUsageUsd,
  sumGatewayCostUsd,
  usageChargeUsd,
} = await import("../usage");

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

describe("estimateTokens", () => {
  it("is 0 for an empty string", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("counts Latin text at ~4 chars per token", () => {
    expect(estimateTokens("abcdefgh")).toBe(2);
    expect(estimateTokens("abcde")).toBe(2);
  });

  it("counts Cyrillic text at ~2.5 chars per token", () => {
    expect(estimateTokens("приветпока")).toBe(4);
    expect(estimateTokens("привет")).toBe(3);
  });

  it("combines both rates for mixed text", () => {
    // 5 Cyrillic = 2 tokens, 4 other (incl. space) = 1 token
    expect(estimateTokens("привет abc")).toBe(Math.ceil(6 / 2.5 + 4 / 4));
  });
});

describe("createInFlightStepTracker", () => {
  it("collects text, reasoning and tool-input deltas", () => {
    const tracker = createInFlightStepTracker();
    tracker.onChunk({ type: "reasoning-delta", text: "think " });
    tracker.onChunk({ type: "text-delta", text: "hello " });
    tracker.onChunk({ type: "tool-input-delta", delta: '{"q":' });
    tracker.onChunk({ type: "source" });
    tracker.onChunk({ type: "tool-result" });

    expect(tracker.outputText()).toBe('think hello {"q":');
  });

  it("forgets the step on reset", () => {
    const tracker = createInFlightStepTracker();
    tracker.onChunk({ type: "text-delta", text: "abc" });
    tracker.reset();

    expect(tracker.outputText()).toBe("");
    tracker.onChunk({ type: "text-delta", text: "def" });
    expect(tracker.outputText()).toBe("def");
  });

  it("tracks tool calls until their result or error arrives", () => {
    const tracker = createInFlightStepTracker();
    tracker.onChunk({ type: "tool-call", toolCallId: "a" });
    tracker.onChunk({ type: "tool-call", toolCallId: "b" });
    expect(tracker.pendingToolCalls()).toBe(2);

    tracker.onChunk({ type: "tool-result", toolCallId: "a" });
    expect(tracker.pendingToolCalls()).toBe(1);

    tracker.onChunk({ type: "tool-error", toolCallId: "b" });
    expect(tracker.pendingToolCalls()).toBe(0);
  });

  it("knows which tool a pending call belongs to", () => {
    const tracker = createInFlightStepTracker();
    tracker.onChunk({
      type: "tool-call",
      toolCallId: "a",
      toolName: "generateImage",
    });
    tracker.onChunk({
      type: "tool-call",
      toolCallId: "b",
      toolName: "webSearch",
    });

    expect(tracker.hasPendingTool("generateImage")).toBe(true);
    tracker.onChunk({ type: "tool-result", toolCallId: "a" });
    expect(tracker.hasPendingTool("generateImage")).toBe(false);
    expect(tracker.hasPendingTool("webSearch")).toBe(true);
  });

  it("forgets pending tool calls on reset", () => {
    const tracker = createInFlightStepTracker();
    tracker.onChunk({ type: "tool-call", toolCallId: "a" });
    tracker.reset();

    expect(tracker.pendingToolCalls()).toBe(0);
  });
});

describe("priceUsageUsd", () => {
  it("returns the TokenLens price", () => {
    expect(
      priceUsageUsd({
        modelId: MODEL_ID,
        usage: buildUsage(),
        catalog: FAKE_CATALOG,
      })
    ).toBeCloseTo(CHAT_TOTAL_USD);
  });

  it("is undefined for an unpriced model or a missing catalog", () => {
    expect(
      priceUsageUsd({
        modelId: "unknown/x",
        usage: buildUsage(),
        catalog: FAKE_CATALOG,
      })
    ).toBeUndefined();
    expect(
      priceUsageUsd({
        modelId: MODEL_ID,
        usage: buildUsage(),
        catalog: undefined,
      })
    ).toBeUndefined();
  });
});

describe("computeAbortedTurnUsage", () => {
  const step = (cost?: string, tokens = { in: 100, out: 50 }) => ({
    usage: {
      inputTokens: tokens.in,
      outputTokens: tokens.out,
      totalTokens: tokens.in + tokens.out,
    } as LanguageModelUsage,
    providerMetadata: cost ? { gateway: { cost } } : undefined,
  });

  it("prices only the estimate when no step has finished", () => {
    const usage = computeAbortedTurnUsage({
      steps: [],
      inFlightOutputText: "abcdefgh",
      promptText: "x".repeat(40),
      accumulator: buildAccumulator(),
      modelId: MODEL_ID,
      catalog: FAKE_CATALOG,
    });

    expect(usageChargeUsd(usage)).toBeCloseTo(CHAT_TOTAL_USD);
    expect(usage.inputTokens).toBe(10);
    expect(usage.outputTokens).toBe(2);
  });

  it("adds the running-step estimate to the gateway cost of finished steps", () => {
    const usage = computeAbortedTurnUsage({
      steps: [step("0.01"), step("0.02", { in: 200, out: 80 })],
      inFlightOutputText: "abcdefgh",
      promptText: "ignored for step > 0",
      accumulator: buildAccumulator(),
      modelId: MODEL_ID,
      catalog: FAKE_CATALOG,
    });

    expect(usageChargeUsd(usage)).toBeCloseTo(0.03 + CHAT_TOTAL_USD);
    // Running step input = previous step input + output.
    expect(usage.inputTokens).toBe(100 + 200 + 280);
    expect(usage.outputTokens).toBe(50 + 80 + 2);
  });

  it("falls back to TokenLens for finished steps without a gateway cost", () => {
    const usage = computeAbortedTurnUsage({
      steps: [step()],
      inFlightOutputText: "abcd",
      promptText: "",
      accumulator: buildAccumulator(),
      modelId: MODEL_ID,
      catalog: FAKE_CATALOG,
    });

    expect(usageChargeUsd(usage)).toBeCloseTo(CHAT_TOTAL_USD * 2);
  });

  it("charges finished steps only, and alarms, when the running step is unpriced", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(vi.fn());
    const usage = computeAbortedTurnUsage({
      steps: [step("0.04")],
      inFlightOutputText: "abcd",
      promptText: "",
      accumulator: buildAccumulator(),
      modelId: MODEL_ID,
      catalog: undefined,
    });

    expect(usageChargeUsd(usage)).toBeCloseTo(0.04);
    expect(usage.inputTokens).toBe(100);
    expect(warn).toHaveBeenCalledWith(
      "[ALARM-USAGE] aborted step unpriced",
      expect.objectContaining({ modelId: MODEL_ID })
    );
    warn.mockRestore();
  });

  it("includes the in-chat image-tool cost", () => {
    const usage = computeAbortedTurnUsage({
      steps: [step("0.01")],
      inFlightOutputText: "abcd",
      promptText: "",
      accumulator: buildAccumulator({ totalCost: 0.05, generationCount: 1 }),
      modelId: MODEL_ID,
      catalog: FAKE_CATALOG,
    });

    expect(usageChargeUsd(usage)).toBeCloseTo(0.01 + CHAT_TOTAL_USD + 0.05);
  });

  it("adds no running-step estimate when the last finished step was terminal", () => {
    const usage = computeAbortedTurnUsage({
      steps: [{ ...step("0.01"), finishReason: "stop" }],
      inFlightOutputText: "",
      promptText: "",
      accumulator: buildAccumulator(),
      modelId: MODEL_ID,
      catalog: FAKE_CATALOG,
    });

    expect(usageChargeUsd(usage)).toBeCloseTo(0.01);
    expect(usage.inputTokens).toBe(100);
  });

  it("still estimates the next step after a tool-calls step", () => {
    const usage = computeAbortedTurnUsage({
      steps: [{ ...step("0.01"), finishReason: "tool-calls" }],
      inFlightOutputText: "",
      promptText: "",
      accumulator: buildAccumulator(),
      modelId: MODEL_ID,
      catalog: FAKE_CATALOG,
    });

    expect(usageChargeUsd(usage)).toBeCloseTo(0.01 + CHAT_TOTAL_USD);
  });
});

describe("computeErroredTurnUsage", () => {
  const step = (cost?: string) => ({
    usage: {
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
    } as LanguageModelUsage,
    providerMetadata: cost ? { gateway: { cost } } : undefined,
  });

  it("bills the gateway cost of the finished steps, with no estimate", () => {
    const usage = computeErroredTurnUsage({
      steps: [step("0.01"), step("0.02")],
      accumulator: buildAccumulator(),
      modelId: MODEL_ID,
      catalog: FAKE_CATALOG,
    });

    expect(usageChargeUsd(usage)).toBeCloseTo(0.03);
    expect(usage.inputTokens).toBe(200);
    expect(usage.outputTokens).toBe(100);
  });

  it("falls back to TokenLens on the summed usage without a gateway cost", () => {
    const usage = computeErroredTurnUsage({
      steps: [step(), step()],
      accumulator: buildAccumulator(),
      modelId: MODEL_ID,
      catalog: FAKE_CATALOG,
    });

    expect(usageChargeUsd(usage)).toBeCloseTo(CHAT_TOTAL_USD);
    expect(usage.inputTokens).toBe(200);
  });

  it("adds the image-tool cost already spent", () => {
    const usage = computeErroredTurnUsage({
      steps: [step("0.01")],
      accumulator: buildAccumulator({ totalCost: 0.05, generationCount: 1 }),
      modelId: MODEL_ID,
      catalog: FAKE_CATALOG,
    });

    expect(usageChargeUsd(usage)).toBeCloseTo(0.06);
  });

  it("prices the text at zero when no step finished, without asking TokenLens", () => {
    const usage = computeErroredTurnUsage({
      steps: [],
      accumulator: buildAccumulator({ totalCost: 0.05, generationCount: 1 }),
      modelId: MODEL_ID,
      catalog: FAKE_CATALOG,
    });

    // The mocked TokenLens would price any usage at CHAT_TOTAL_USD.
    expect(usageChargeUsd(usage)).toBeCloseTo(0.05);
  });
});
