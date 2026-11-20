import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatMessage } from "@/lib/types";
import type { ImageGenInput } from "../image/types";

const {
  sdkGenerateImageMock,
  resolveLatestImageUrlMock,
  supportsAttachmentsMock,
} = vi.hoisted(() => ({
  sdkGenerateImageMock: vi.fn(),
  resolveLatestImageUrlMock: vi.fn(),
  supportsAttachmentsMock: vi.fn(),
}));

vi.mock("ai", () => ({
  generateImage: sdkGenerateImageMock,
  streamText: vi.fn(),
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
  getDedicatedImageGatewayModelId: (modelId: string) =>
    modelId.startsWith("seedream")
      ? `bytedance/${modelId}`
      : `other/${modelId}`,
  getModelById: vi.fn(),
  getOpenAIImageGatewayModelId: (modelId: string) => modelId,
  isDedicatedImageModel: () => true,
  isOpenAIImageModel: () => false,
  supportsAttachments: supportsAttachmentsMock,
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

const SOURCE_IMAGE_URL =
  "https://store.public.blob.vercel-storage.com/source.png";

const buildInput = (modelId: string): ImageGenInput => ({
  modelId,
  prompt: "a cat",
  settings: undefined,
  uiMessages: [] as ChatMessage[],
  abortSignal: new AbortController().signal,
  onReasoning: vi.fn(),
});

const buildSdkResult = (mediaType: string) => ({
  image: { base64: "aGk=", mediaType },
  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
  providerMetadata: undefined,
});

describe("dedicated image provider", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    supportsAttachmentsMock.mockReturnValue(true);
    vi.spyOn(console, "warn").mockReturnValue(undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new Uint8Array(4), { status: 200 }))
    );
  });

  it.each(["seedream-5.5", "seedream-5.0-pro"])(
    "turns the ByteDance watermark off for %s on generation",
    async (modelId) => {
      sdkGenerateImageMock.mockResolvedValue(buildSdkResult("image/png"));

      await resolveImageProvider(modelId)(buildInput(modelId));

      expect(sdkGenerateImageMock.mock.calls[0][0].providerOptions).toEqual({
        bytedance: { watermark: false },
      });
    }
  );

  it("turns the ByteDance watermark off on an edit as well", async () => {
    resolveLatestImageUrlMock.mockReturnValue(SOURCE_IMAGE_URL);
    sdkGenerateImageMock.mockResolvedValue(buildSdkResult("image/png"));

    await resolveImageProvider("seedream-5.5")(buildInput("seedream-5.5"));

    const [call] = sdkGenerateImageMock.mock.calls[0];
    expect(call.prompt).toHaveProperty("images");
    expect(call.providerOptions).toEqual({ bytedance: { watermark: false } });
  });

  it("sends no provider options to a non-ByteDance model", async () => {
    sdkGenerateImageMock.mockResolvedValue(buildSdkResult("image/png"));

    await resolveImageProvider("flux-3-image-klein")(
      buildInput("flux-3-image-klein")
    );

    expect(sdkGenerateImageMock.mock.calls[0][0]).not.toHaveProperty(
      "providerOptions"
    );
  });

  it("goes straight to text-to-image for a model without attachments", async () => {
    supportsAttachmentsMock.mockReturnValue(false);
    resolveLatestImageUrlMock.mockReturnValue(SOURCE_IMAGE_URL);
    sdkGenerateImageMock.mockResolvedValue(buildSdkResult("image/webp"));

    await resolveImageProvider("recraft-v4.1-flash")(
      buildInput("recraft-v4.1-flash")
    );

    expect(fetch).not.toHaveBeenCalled();
    expect(sdkGenerateImageMock).toHaveBeenCalledTimes(1);
    expect(sdkGenerateImageMock.mock.calls[0][0].prompt).toBe("a cat");
  });

  it("reports the media type the SDK returned", async () => {
    sdkGenerateImageMock.mockResolvedValue(buildSdkResult("image/jpeg"));

    const result = await resolveImageProvider("flux-3-image-klein")(
      buildInput("flux-3-image-klein")
    );

    expect(result.mediaType).toBe("image/jpeg");
  });

  it("falls back to PNG when the SDK reports no media type", async () => {
    sdkGenerateImageMock.mockResolvedValue({
      ...buildSdkResult("image/png"),
      image: { base64: "aGk=" },
    });

    const result = await resolveImageProvider("mai-image-2.7")(
      buildInput("mai-image-2.7")
    );

    expect(result.mediaType).toBe("image/png");
  });
});
