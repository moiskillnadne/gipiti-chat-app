import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatMessage } from "@/lib/types";
import type { ChatTurnContext, StreamWriter } from "../context";
import type { ImageGenInput, ImageGenResult } from "../image/types";
import { createTurnAbort } from "../turn-abort";

const {
  resolveImageProviderMock,
  uploadGeneratedImageMock,
  saveDocumentMock,
  chargeUsageSafeMock,
} = vi.hoisted(() => ({
  resolveImageProviderMock: vi.fn(),
  uploadGeneratedImageMock: vi.fn(),
  saveDocumentMock: vi.fn(),
  chargeUsageSafeMock: vi.fn(),
}));

vi.mock("../image/providers", () => ({
  resolveImageProvider: resolveImageProviderMock,
}));
vi.mock("@/lib/ai/media-upload", () => ({
  uploadGeneratedImage: uploadGeneratedImageMock,
  generateImageGenerationId: () => "generated-id",
}));
vi.mock("@/lib/ai/models", () => ({
  normalizeAspectRatio: (aspectRatio?: string) => aspectRatio,
}));
vi.mock("@/lib/db/query/document/save-document", () => ({
  saveDocument: saveDocumentMock,
}));
vi.mock("@/lib/subscription/is-free-user", () => ({
  isFreeUserById: vi.fn().mockResolvedValue(false),
}));
vi.mock("../charge", () => ({ chargeUsageSafe: chargeUsageSafeMock }));

import { runImageGeneration } from "../handlers/image-generation";

const IMAGE_URL = "https://blob.example/image.png";

type WrittenPart = {
  type: string;
  id?: string;
  data?: { status?: string; url?: string };
};

const buildContext = (): ChatTurnContext =>
  ({
    userId: "user-1",
    chatId: "chat-1",
    model: "image-model",
    message: {
      id: "message-1",
      role: "user",
      parts: [{ type: "text", text: "a red fox" }],
    } as ChatMessage,
    uiMessages: [],
    imageGenSetting: undefined,
    imageUsageAccumulator: {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCost: 0,
      generationCount: 0,
    },
    turnAbort: createTurnAbort(),
  }) as unknown as ChatTurnContext;

const buildWriter = () => {
  const write = vi.fn();
  return { writer: { write } as unknown as StreamWriter, write };
};

const mediaStatuses = (write: ReturnType<typeof vi.fn>): string[] =>
  write.mock.calls
    .map(([part]) => part as WrittenPart)
    .filter((part) => part.type === "data-mediaGeneration")
    .map((part) => part.data?.status ?? "");

/** A provider that stays pending until the turn signal aborts, like fetch. */
const providerRejectingOnAbort = () =>
  vi.fn(
    ({ abortSignal }: ImageGenInput) =>
      new Promise<ImageGenResult>((_resolve, reject) => {
        abortSignal.addEventListener("abort", () => reject(abortSignal.reason));
      })
  );

describe("runImageGeneration stop handling", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    uploadGeneratedImageMock.mockResolvedValue(IMAGE_URL);
    saveDocumentMock.mockResolvedValue([]);
    chargeUsageSafeMock.mockResolvedValue(undefined);
    vi.spyOn(console, "info").mockReturnValue(undefined);
    vi.spyOn(console, "error").mockReturnValue(undefined);
  });

  it("hands the turn abort signal to the provider", async () => {
    const ctx = buildContext();
    const provider = vi.fn().mockResolvedValue({ costUsd: 0 });
    resolveImageProviderMock.mockReturnValue(provider);
    const { writer } = buildWriter();

    await runImageGeneration(ctx, writer);

    expect(provider.mock.calls[0][0].abortSignal).toBe(ctx.turnAbort.signal);
  });

  it("writes a stopped card and skips upload, save and charge when stopped mid-generation", async () => {
    const ctx = buildContext();
    resolveImageProviderMock.mockReturnValue(providerRejectingOnAbort());
    const { writer, write } = buildWriter();

    const running = runImageGeneration(ctx, writer);
    ctx.turnAbort.requestAbort();
    await running;

    const lastPart = write.mock.calls.at(-1)?.[0] as WrittenPart;
    expect(lastPart.type).toBe("data-mediaGeneration");
    expect(lastPart.id).toBeDefined();
    expect(mediaStatuses(write)).toEqual(["generating", "stopped"]);
    expect(ctx.turnOutcome).toBe("aborted");
    expect(uploadGeneratedImageMock).not.toHaveBeenCalled();
    expect(saveDocumentMock).not.toHaveBeenCalled();
    expect(chargeUsageSafeMock).not.toHaveBeenCalled();
    expect(console.info).toHaveBeenCalledWith(
      "[media-stop]",
      expect.objectContaining({
        chatId: "chat-1",
        modelId: "image-model",
        mediaType: "image",
      })
    );
  });

  it("reuses the generating part id for the stopped card", async () => {
    const ctx = buildContext();
    resolveImageProviderMock.mockReturnValue(providerRejectingOnAbort());
    const { writer, write } = buildWriter();

    const running = runImageGeneration(ctx, writer);
    ctx.turnAbort.requestAbort();
    await running;

    const [generating, stopped] = write.mock.calls.map(
      ([part]) => part as WrittenPart
    );
    expect(stopped.id).toBe(generating.id);
  });

  it("delivers and charges a result that was already in hand when the stop landed", async () => {
    const ctx = buildContext();
    resolveImageProviderMock.mockReturnValue(
      vi.fn().mockResolvedValue({
        base64: "aGVsbG8=",
        mediaType: "image/png",
        costUsd: 0.04,
        responseId: "response-1",
      })
    );
    // The stop lands while the upload is running, after the provider returned.
    uploadGeneratedImageMock.mockImplementation(() => {
      ctx.turnAbort.requestAbort();
      return Promise.resolve(IMAGE_URL);
    });
    const { writer, write } = buildWriter();

    await runImageGeneration(ctx, writer);

    expect(mediaStatuses(write)).toEqual(["generating", "done"]);
    expect(saveDocumentMock).toHaveBeenCalledTimes(1);
    expect(chargeUsageSafeMock).toHaveBeenCalledWith(
      expect.objectContaining({ usdCost: 0.04 }),
      expect.any(String)
    );
    expect(ctx.turnOutcome).toBe("completed");
  });

  it("writes an error card for a failure that is not a stop", async () => {
    const ctx = buildContext();
    resolveImageProviderMock.mockReturnValue(
      vi.fn().mockRejectedValue(new Error("gateway exploded"))
    );
    const { writer, write } = buildWriter();

    await runImageGeneration(ctx, writer);

    expect(mediaStatuses(write)).toEqual(["generating", "error"]);
    expect(ctx.turnOutcome).toBe("completed");
    expect(chargeUsageSafeMock).not.toHaveBeenCalled();
  });

  it("writes an error card when the provider returns no image", async () => {
    const ctx = buildContext();
    resolveImageProviderMock.mockReturnValue(
      vi.fn().mockResolvedValue({ costUsd: 0 })
    );
    const { writer, write } = buildWriter();

    await runImageGeneration(ctx, writer);

    expect(mediaStatuses(write)).toEqual(["generating", "error"]);
    expect(ctx.turnOutcome).toBe("completed");
  });
});
