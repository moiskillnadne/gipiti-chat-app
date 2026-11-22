import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TurnSlot } from "@/lib/billing/turn-slots";
import type { ChatMessage } from "@/lib/types";
import type { ChatTurnContext, StreamWriter } from "../context";
import { createTurnAbort } from "../turn-abort";
import { createTurnSettlement } from "../turn-lifecycle";

type StreamTextOptions = {
  onFinish: (event: {
    usage: Record<string, number>;
    totalUsage: { inputTokens?: number; outputTokens?: number };
    steps: unknown[];
  }) => Promise<void>;
};

const {
  chargeUsageSafeMock,
  streamTextMock,
  attachDocxContentMock,
  resolveImageProviderMock,
  uploadGeneratedImageMock,
  saveDocumentMock,
} = vi.hoisted(() => ({
  chargeUsageSafeMock: vi.fn(),
  streamTextMock: vi.fn(),
  attachDocxContentMock: vi.fn(),
  resolveImageProviderMock: vi.fn(),
  uploadGeneratedImageMock: vi.fn(),
  saveDocumentMock: vi.fn(),
}));

vi.mock("@/app/(chat)/api/chat/_lib/charge", () => ({
  chargeUsageSafe: chargeUsageSafeMock,
}));

// Text handler dependencies.
vi.mock("ai", () => ({
  convertToModelMessages: async () => [],
  stepCountIs: () => () => false,
  streamText: streamTextMock,
}));
vi.mock("@/lib/ai/docx-extract", () => ({
  attachDocxContentForModel: attachDocxContentMock,
}));
vi.mock("@/lib/ai/text-attachments", () => ({
  attachTextContentForModel: async (messages: unknown) => messages,
}));
vi.mock("@/lib/ai/models", () => ({
  getProviderOptions: vi.fn(),
  isAutoReasoning: () => false,
  isGoogleModel: () => false,
  isReasoningModelId: () => false,
  supportsPdfInput: () => true,
  supportsThinkingConfig: () => false,
  supportsToolCalling: () => false,
  normalizeAspectRatio: (aspectRatio?: string) => aspectRatio,
}));
vi.mock("@/lib/ai/prompts", () => ({
  buildContextMessage: () => null,
  systemPrompt: () => "system",
}));
vi.mock("@/lib/ai/providers", () => ({
  myProvider: { languageModel: () => ({ modelId: "text-model" }) },
}));
vi.mock("@/lib/ai/resolve-latest-image", () => ({
  resolveLatestImageUrl: vi.fn(),
}));
vi.mock("@/lib/ai/tools/calculator", () => ({ calculator: {} }));
vi.mock("@/lib/ai/tools/extract-url", () => ({ extractUrl: vi.fn() }));
vi.mock("@/lib/ai/tools/generate-csv", () => ({ generateCsv: vi.fn() }));
vi.mock("@/lib/ai/tools/generate-docx", () => ({ generateDocx: vi.fn() }));
vi.mock("@/lib/ai/tools/generate-image", () => ({ generateImage: vi.fn() }));
vi.mock("@/lib/ai/tools/generate-markdown", () => ({
  generateMarkdown: vi.fn(),
}));
vi.mock("@/lib/ai/tools/generate-pdf", () => ({ generatePdf: vi.fn() }));
vi.mock("@/lib/ai/tools/generate-txt", () => ({ generateTxt: vi.fn() }));
vi.mock("@/lib/ai/tools/web-search", () => ({ webSearch: vi.fn() }));
vi.mock("@/server/env", () => ({
  isGeminiSignatureDebugEnabled: false,
  isProductionEnvironment: false,
}));
vi.mock("@/app/(chat)/api/chat/_lib/usage", () => ({
  computeAbortedTurnUsage: vi.fn(),
  computeErroredTurnUsage: vi.fn(),
  createInFlightStepTracker: () => ({
    onChunk: vi.fn(),
    reset: vi.fn(),
    outputText: () => "",
    pendingToolCalls: () => 0,
    hasPendingTool: () => false,
  }),
  getTokenlensCatalog: vi.fn(),
  mergeUsage: () => ({}),
  sumGatewayCostUsd: () => 0,
  usageChargeUsd: () => 0.01,
}));

// Image handler dependencies.
vi.mock("@/app/(chat)/api/chat/_lib/image/providers", () => ({
  resolveImageProvider: resolveImageProviderMock,
}));
vi.mock("@/lib/ai/media-upload", () => ({
  uploadGeneratedImage: uploadGeneratedImageMock,
  generateImageGenerationId: () => "generated-id",
}));
vi.mock("@/lib/db/query/document/save-document", () => ({
  saveDocument: saveDocumentMock,
}));
vi.mock("@/lib/subscription/is-free-user", () => ({
  isFreeUserById: vi.fn().mockResolvedValue(false),
}));

import { runImageGeneration } from "../handlers/image-generation";
import { runTextChat } from "../handlers/text-chat";
import { runHoldingTurnSlot } from "../turn-slot";

const buildContext = (): ChatTurnContext =>
  ({
    session: { user: { id: "user-1" } },
    userId: "user-1",
    chatId: "chat-1",
    model: "test-model",
    message: {
      id: "message-1",
      role: "user",
      parts: [{ type: "text", text: "a red fox" }],
    } as ChatMessage,
    uiMessages: [],
    stepLimit: 5,
    requestHints: {},
    projectContext: null,
    imageGenSetting: undefined,
    imageUsageAccumulator: {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCost: 0,
      generationCount: 0,
    },
    lastUsage: {},
    turnAbort: createTurnAbort(),
    turnSettlement: createTurnSettlement(),
  }) as unknown as ChatTurnContext;

const buildWriter = (): StreamWriter =>
  ({ write: vi.fn(), merge: vi.fn() }) as unknown as StreamWriter;

const buildSlot = () => {
  const release = vi.fn(() => Promise.resolve());
  const slot: TurnSlot = { release, whenReleased: Promise.resolve() };
  return { slot, release };
};

/** Lets pending promise callbacks run. */
const flushPromises = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
};

describe("runHoldingTurnSlot: text turn", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    attachDocxContentMock.mockImplementation(async (messages) => messages);
    streamTextMock.mockReturnValue({
      // The stream never ends on its own: only onFinish settles the turn.
      consumeStream: () => new Promise<void>(vi.fn()),
      toUIMessageStream: () => new ReadableStream(),
    });
  });

  it("releases the slot only after the charge resolves", async () => {
    // Arrange
    const ctx = buildContext();
    const { slot, release } = buildSlot();
    const charge = Promise.withResolvers<void>();
    chargeUsageSafeMock.mockReturnValue(charge.promise);
    await runHoldingTurnSlot({
      mode: "text",
      ctx,
      slot,
      run: () => runTextChat(ctx, buildWriter()),
    });
    const [options] = streamTextMock.mock.calls[0] as [StreamTextOptions];

    // Act
    const finished = options.onFinish({
      usage: {},
      totalUsage: { inputTokens: 10, outputTokens: 10 },
      steps: [],
    });
    await flushPromises();

    // Assert
    expect(chargeUsageSafeMock).toHaveBeenCalledTimes(1);
    expect(release).not.toHaveBeenCalled();
    charge.resolve();
    await finished;
    await flushPromises();
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("releases the slot when the turn throws", async () => {
    const ctx = buildContext();
    const { slot, release } = buildSlot();
    attachDocxContentMock.mockRejectedValue(new Error("extract failed"));

    await expect(
      runHoldingTurnSlot({
        mode: "text",
        ctx,
        slot,
        run: () => runTextChat(ctx, buildWriter()),
      })
    ).rejects.toThrow("extract failed");
    await flushPromises();

    expect(release).toHaveBeenCalledTimes(1);
  });
});

describe("runHoldingTurnSlot: image turn", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    resolveImageProviderMock.mockReturnValue(
      vi.fn().mockResolvedValue({
        base64: "aW1hZ2U=",
        mediaType: "image/png",
        usageMetadata: { promptTokenCount: 1 },
        costUsd: 0.04,
        responseId: "response-1",
      })
    );
    uploadGeneratedImageMock.mockResolvedValue("https://blob.example/a.png");
    saveDocumentMock.mockResolvedValue(undefined);
  });

  it("releases the slot only after the charge resolves", async () => {
    // Arrange
    const ctx = buildContext();
    const { slot, release } = buildSlot();
    const charge = Promise.withResolvers<void>();
    chargeUsageSafeMock.mockReturnValue(charge.promise);

    // Act
    const running = runHoldingTurnSlot({
      mode: "image",
      ctx,
      slot,
      run: () => runImageGeneration(ctx, buildWriter()),
    });
    await flushPromises();

    // Assert
    expect(chargeUsageSafeMock).toHaveBeenCalledTimes(1);
    expect(release).not.toHaveBeenCalled();
    charge.resolve();
    await running;
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("releases the slot when the turn throws", async () => {
    const ctx = buildContext();
    const { slot, release } = buildSlot();
    saveDocumentMock.mockRejectedValue(new Error("db down"));

    await expect(
      runHoldingTurnSlot({
        mode: "image",
        ctx,
        slot,
        run: () => runImageGeneration(ctx, buildWriter()),
      })
    ).rejects.toThrow("db down");

    expect(release).toHaveBeenCalledTimes(1);
  });
});
