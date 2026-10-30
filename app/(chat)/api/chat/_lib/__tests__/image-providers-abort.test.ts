import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatMessage } from "@/lib/types";
import type { ImageGenInput } from "../image/types";
import { createTurnAbort } from "../turn-abort";

const {
  sdkGenerateImageMock,
  resolveLatestImageUrlMock,
  streamTextMock,
  isDedicatedImageModelMock,
} = vi.hoisted(() => ({
  sdkGenerateImageMock: vi.fn(),
  resolveLatestImageUrlMock: vi.fn(),
  streamTextMock: vi.fn(),
  isDedicatedImageModelMock: vi.fn(),
}));

vi.mock("ai", () => ({
  generateImage: sdkGenerateImageMock,
  streamText: streamTextMock,
  convertToModelMessages: vi.fn().mockResolvedValue([]),
}));
vi.mock("@ai-sdk/gateway", () => ({
  gateway: { imageModel: (modelId: string) => ({ modelId }) },
}));
vi.mock("@ai-sdk/provider", () => ({
  APICallError: { isInstance: () => false },
}));
vi.mock("@/lib/ai/media-upload", () => ({
  generateImageGenerationId: () => "generated-id",
}));
vi.mock("@/lib/ai/models", () => ({
  getDedicatedImageGatewayModelId: (modelId: string) => `gateway/${modelId}`,
  getModelById: vi.fn(),
  getOpenAIImageGatewayModelId: (modelId: string) => modelId,
  isDedicatedImageModel: isDedicatedImageModelMock,
  isOpenAIImageModel: () => false,
}));
vi.mock("@/lib/ai/providers", () => ({
  myProvider: { languageModel: (modelId: string) => ({ modelId }) },
}));
vi.mock("@/lib/ai/recraft-client", () => ({
  generateRecraftImage: vi.fn(),
  isRecraftModel: () => false,
}));
vi.mock("@/lib/ai/resolve-latest-image", () => ({
  resolveLatestImageUrl: resolveLatestImageUrlMock,
}));
vi.mock("@/lib/db/query/document/get-document-by-generation-id", () => ({
  getDocumentByGenerationId: vi.fn(),
}));

import { resolveImageProvider } from "../image/providers";

const SOURCE_IMAGE_URL = "https://blob.example/source.png";

const buildInput = (abortSignal: AbortSignal): ImageGenInput => ({
  modelId: "flux-test",
  prompt: "make it blue",
  settings: undefined,
  uiMessages: [] as ChatMessage[],
  abortSignal,
  onReasoning: vi.fn(),
});

const successResult = {
  image: { base64: "aGk=" },
  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
  providerMetadata: undefined,
};

describe("dedicated image provider abort handling", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    isDedicatedImageModelMock.mockReturnValue(true);
    vi.spyOn(console, "warn").mockReturnValue(undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(4),
      })
    );
  });

  it("gives the turn signal to the SDK call", async () => {
    const turnAbort = createTurnAbort();
    resolveLatestImageUrlMock.mockReturnValue(undefined);
    sdkGenerateImageMock.mockResolvedValue(successResult);

    await resolveImageProvider("flux-test")(buildInput(turnAbort.signal));

    expect(sdkGenerateImageMock.mock.calls[0][0].abortSignal).toBe(
      turnAbort.signal
    );
  });

  it("gives the turn signal to the source image download", async () => {
    const turnAbort = createTurnAbort();
    resolveLatestImageUrlMock.mockReturnValue(SOURCE_IMAGE_URL);
    sdkGenerateImageMock.mockResolvedValue(successResult);

    await resolveImageProvider("flux-test")(buildInput(turnAbort.signal));

    expect(fetch).toHaveBeenCalledWith(SOURCE_IMAGE_URL, {
      signal: turnAbort.signal,
    });
  });

  it("does not fall back to text-to-image when the edit was aborted", async () => {
    const turnAbort = createTurnAbort();
    resolveLatestImageUrlMock.mockReturnValue(SOURCE_IMAGE_URL);
    sdkGenerateImageMock.mockImplementation(() => {
      turnAbort.requestAbort();
      return Promise.reject(turnAbort.signal.reason);
    });

    await expect(
      resolveImageProvider("flux-test")(buildInput(turnAbort.signal))
    ).rejects.toMatchObject({ name: "AbortError" });

    expect(sdkGenerateImageMock).toHaveBeenCalledTimes(1);
  });

  it("still falls back to text-to-image when an edit fails without a stop", async () => {
    const turnAbort = createTurnAbort();
    resolveLatestImageUrlMock.mockReturnValue(SOURCE_IMAGE_URL);
    sdkGenerateImageMock
      .mockRejectedValueOnce(new Error("edit route not supported"))
      .mockResolvedValueOnce(successResult);

    const result = await resolveImageProvider("flux-test")(
      buildInput(turnAbort.signal)
    );

    expect(sdkGenerateImageMock).toHaveBeenCalledTimes(2);
    expect(result.base64).toBe("aGk=");
  });
});

type StreamDelta = { type: string } & Record<string, unknown>;

const FILE_DELTA: StreamDelta = {
  type: "file",
  file: { base64Data: "aGk=", mediaType: "image/png" },
};
const FINISH_STEP_DELTA: StreamDelta = { type: "finish-step" };
const GATEWAY_COST_USD = "0.04";

/** A `streamText` result whose stream yields `deltas`, calling `afterDelta` after each. */
const mockStreamText = (
  deltas: StreamDelta[],
  afterDelta?: (delta: StreamDelta) => void
): void => {
  streamTextMock.mockReturnValue({
    fullStream: (function* () {
      for (const delta of deltas) {
        yield delta;
        afterDelta?.(delta);
      }
    })(),
    providerMetadata: Promise.resolve({
      gateway: { cost: GATEWAY_COST_USD },
    }),
  });
};

describe("multimodal image provider abort handling", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    isDedicatedImageModelMock.mockReturnValue(false);
    resolveLatestImageUrlMock.mockReturnValue(undefined);
    vi.spyOn(console, "warn").mockReturnValue(undefined);
  });

  it("rejects with the abort reason when stopped before any file arrived", async () => {
    const turnAbort = createTurnAbort();
    mockStreamText([{ type: "start" }], () => turnAbort.requestAbort());

    const generation = resolveImageProvider("gemini-test")(
      buildInput(turnAbort.signal)
    );

    const rejection = await generation.catch((error: unknown) => error);
    expect(rejection).toBe(turnAbort.signal.reason);
    expect(rejection).toMatchObject({ name: "AbortError" });
  });

  it("rejects when stopped after the file but before the step finished", async () => {
    const turnAbort = createTurnAbort();
    mockStreamText([FILE_DELTA], () => turnAbort.requestAbort());

    const generation = resolveImageProvider("gemini-test")(
      buildInput(turnAbort.signal)
    );

    await expect(generation).rejects.toMatchObject({ name: "AbortError" });
  });

  it("returns the image with its cost when the step finished without a stop", async () => {
    const turnAbort = createTurnAbort();
    mockStreamText([FILE_DELTA, FINISH_STEP_DELTA]);

    const result = await resolveImageProvider("gemini-test")(
      buildInput(turnAbort.signal)
    );

    expect(result.base64).toBe("aGk=");
    expect(result.costUsd).toBe(Number.parseFloat(GATEWAY_COST_USD));
  });

  it("still delivers the image when the stop lands after the step finished", async () => {
    const turnAbort = createTurnAbort();
    mockStreamText([FILE_DELTA, FINISH_STEP_DELTA], (delta) => {
      if (delta === FINISH_STEP_DELTA) {
        turnAbort.requestAbort();
      }
    });

    const result = await resolveImageProvider("gemini-test")(
      buildInput(turnAbort.signal)
    );

    expect(turnAbort.signal.aborted).toBe(true);
    expect(result.base64).toBe("aGk=");
    expect(result.costUsd).toBe(Number.parseFloat(GATEWAY_COST_USD));
  });
});
