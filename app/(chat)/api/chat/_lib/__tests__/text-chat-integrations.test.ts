import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IntegrationTurnConnection } from "@/lib/db/query/integration/get-by-ids-for-user";
import type { ChatMessage } from "@/lib/types";
import type { ChatTurnContext, StreamWriter } from "../context";
import { createTurnAbort } from "../turn-abort";

const { streamTextMock, buildPlanMock, closeMock } = vi.hoisted(() => ({
  streamTextMock: vi.fn(),
  buildPlanMock: vi.fn(),
  closeMock: vi.fn(),
}));

vi.mock("ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("ai")>()),
  streamText: streamTextMock,
}));
vi.mock("@/lib/integrations/turn-plan", () => ({
  buildIntegrationTurnPlan: buildPlanMock,
}));
vi.mock("@/lib/ai/models", () => ({
  getProviderOptions: vi.fn(),
  isAutoReasoning: () => false,
  isGoogleModel: () => false,
  isReasoningModelId: () => false,
  supportsMcp: () => true,
  supportsThinkingConfig: () => false,
  supportsToolCalling: () => true,
}));
vi.mock("@/lib/ai/providers", () => ({
  myProvider: { languageModel: () => ({ modelId: "test-model" }) },
}));
vi.mock("@/lib/ai/prompts", () => ({
  buildContextMessage: () => null,
  systemPrompt: () => "system",
}));
vi.mock("@/lib/ai/resolve-latest-image", () => ({
  resolveLatestImageUrl: vi.fn(),
}));
vi.mock("@/lib/ai/docx-extract", () => ({
  attachDocxContentForModel: (messages: unknown) => messages,
}));
vi.mock("@/lib/ai/text-attachments", () => ({
  attachTextContentForModel: (messages: unknown) => messages,
}));
vi.mock("@/lib/ai/tools/calculator", () => ({ calculator: {} }));
vi.mock("@/lib/ai/tools/web-search", () => ({ webSearch: () => ({}) }));
vi.mock("@/lib/ai/tools/extract-url", () => ({ extractUrl: () => ({}) }));
vi.mock("@/lib/ai/tools/generate-image", () => ({ generateImage: () => ({}) }));
vi.mock("@/lib/ai/tools/generate-pdf", () => ({ generatePdf: () => ({}) }));
vi.mock("@/lib/ai/tools/generate-docx", () => ({ generateDocx: () => ({}) }));
vi.mock("@/lib/ai/tools/generate-markdown", () => ({
  generateMarkdown: () => ({}),
}));
vi.mock("@/lib/ai/tools/generate-txt", () => ({ generateTxt: () => ({}) }));
vi.mock("@/lib/ai/tools/generate-csv", () => ({ generateCsv: () => ({}) }));
vi.mock("../charge", () => ({ chargeUsageSafe: vi.fn() }));
vi.mock("../usage", () => ({
  computeAbortedTurnUsage: vi.fn(),
  computeErroredTurnUsage: vi.fn(),
  createInFlightStepTracker: () => ({
    recordStepStart: vi.fn(),
    recordStepFinish: vi.fn(),
    recordTextDelta: vi.fn(),
    snapshot: vi.fn(),
  }),
  getTokenlensCatalog: vi.fn(),
  mergeUsage: vi.fn(),
  sumGatewayCostUsd: vi.fn(),
  usageChargeUsd: vi.fn(),
}));

import { runTextChat } from "../handlers/text-chat";

const BASE_TOOL_NAMES = [
  "calculator",
  "extractUrl",
  "generateCsv",
  "generateDocx",
  "generateImage",
  "generateMarkdown",
  "generatePdf",
  "generateTxt",
  "webSearch",
];

const CONNECTION = { id: "integration-1" } as IntegrationTurnConnection;

const userMessage = {
  id: "message-1",
  role: "user",
  parts: [{ type: "text", text: "hi" }],
} as ChatMessage;

const buildContext = (
  overrides: Partial<ChatTurnContext> = {}
): ChatTurnContext =>
  ({
    session: { user: { id: "user-1" } },
    userId: "user-1",
    chatId: "chat-1",
    model: "test-model",
    message: userMessage,
    uiMessages: [userMessage],
    stepLimit: 5,
    integrationConnections: [],
    imageUsageAccumulator: { totalCost: 0 },
    lastUsage: {},
    turnAbort: createTurnAbort(),
    turnSettlement: { resolve: vi.fn(), promise: Promise.resolve() },
    ...overrides,
  }) as unknown as ChatTurnContext;

const buildWriter = () => ({ merge: vi.fn(), write: vi.fn() });

const run = async (ctx: ChatTurnContext) => {
  const writer = buildWriter();
  await runTextChat(ctx, writer as unknown as StreamWriter);
  return streamTextMock.mock.calls[0][0];
};

describe("runTextChat integrations wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    streamTextMock.mockReturnValue({
      consumeStream: () => Promise.resolve(),
      toUIMessageStream: () => new ReadableStream(),
    });
    buildPlanMock.mockReturnValue({
      tools: { mcp_deepwiki__ask: { description: "ask" } },
      close: closeMock.mockResolvedValue(undefined),
    });
  });

  it("passes the unchanged tool set and telemetry without integrations", async () => {
    // Arrange
    const ctx = buildContext();

    // Act
    const options = await run(ctx);

    // Assert
    expect(Object.keys(options.tools).sort()).toEqual(BASE_TOOL_NAMES);
    expect(Object.keys(options.experimental_telemetry).sort()).toEqual([
      "functionId",
      "isEnabled",
    ]);
    expect(buildPlanMock).not.toHaveBeenCalled();
  });

  it("adds plan tools and stops recording telemetry content", async () => {
    // Arrange
    const ctx = buildContext({ integrationConnections: [CONNECTION] });

    // Act
    const options = await run(ctx);

    // Assert
    expect(Object.keys(options.tools)).toContain("mcp_deepwiki__ask");
    expect(options.tools.calculator).toBeDefined();
    expect(options.experimental_telemetry).toMatchObject({
      recordInputs: false,
      recordOutputs: false,
    });
  });

  it("closes the plan once the stream has ended", async () => {
    // Arrange
    const ctx = buildContext({ integrationConnections: [CONNECTION] });

    // Act
    await run(ctx);
    await vi.waitFor(() => expect(closeMock).toHaveBeenCalled());

    // Assert
    expect(closeMock).toHaveBeenCalledTimes(1);
  });
});
