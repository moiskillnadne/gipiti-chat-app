import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatMessage } from "@/lib/types";
import type { ChatTurnContext, StreamWriter } from "../context";
import { createTurnAbort } from "../turn-abort";

const {
  generateVideoMock,
  uploadGeneratedVideoMock,
  saveDocumentMock,
  chargeUsageSafeMock,
} = vi.hoisted(() => ({
  generateVideoMock: vi.fn(),
  uploadGeneratedVideoMock: vi.fn(),
  saveDocumentMock: vi.fn(),
  chargeUsageSafeMock: vi.fn(),
}));

vi.mock("ai", () => ({ experimental_generateVideo: generateVideoMock }));
vi.mock("@ai-sdk/gateway", () => ({
  gateway: { videoModel: (modelId: string) => ({ modelId }) },
}));
vi.mock("@/lib/ai/media-upload", () => ({
  uploadGeneratedVideo: uploadGeneratedVideoMock,
}));
vi.mock("@/lib/ai/models", () => ({
  getVideoGenConfig: () => ({
    gatewayModelId: "test/video",
    durationSeconds: 5,
    imageInput: "unsupported",
  }),
  normalizeAspectRatio: (aspectRatio?: string) => aspectRatio,
}));
vi.mock("@/lib/db/query/document/save-document", () => ({
  saveDocument: saveDocumentMock,
}));
vi.mock("../charge", () => ({ chargeUsageSafe: chargeUsageSafeMock }));

import { runVideoGeneration } from "../handlers/video-generation";

const KEEPALIVE_INTERVAL_MS = 15_000;

type GenerateVideoCall = { abortSignal: AbortSignal };

const buildContext = (): ChatTurnContext =>
  ({
    userId: "user-1",
    chatId: "chat-1",
    model: "video-model",
    message: {
      id: "message-1",
      role: "user",
      parts: [{ type: "text", text: "a fox running" }],
    } as ChatMessage,
    videoGenSetting: undefined,
    turnAbort: createTurnAbort(),
  }) as unknown as ChatTurnContext;

const buildWriter = () => {
  const write = vi.fn();
  return { writer: { write } as unknown as StreamWriter, write };
};

const mediaStatuses = (write: ReturnType<typeof vi.fn>): string[] =>
  write.mock.calls
    .map(([part]) => part as { type: string; data?: { status?: string } })
    .filter((part) => part.type === "data-mediaGeneration")
    .map((part) => part.data?.status ?? "");

const rejectOnAbort = ({ abortSignal }: GenerateVideoCall) =>
  new Promise<never>((_resolve, reject) => {
    abortSignal.addEventListener("abort", () => reject(abortSignal.reason));
  });

describe("runVideoGeneration stop handling", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    uploadGeneratedVideoMock.mockResolvedValue("https://blob.example/v.mp4");
    saveDocumentMock.mockResolvedValue([]);
    chargeUsageSafeMock.mockResolvedValue(undefined);
    vi.spyOn(console, "info").mockReturnValue(undefined);
    vi.spyOn(console, "error").mockReturnValue(undefined);
    vi.spyOn(console, "warn").mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("passes the turn abort signal to the video request", async () => {
    const ctx = buildContext();
    generateVideoMock.mockResolvedValue({ video: undefined });
    const { writer } = buildWriter();

    await runVideoGeneration(ctx, writer);

    expect(generateVideoMock.mock.calls[0][0].abortSignal).toBe(
      ctx.turnAbort.signal
    );
  });

  it("writes a stopped card, charges nothing and stops the keep-alive when aborted", async () => {
    const ctx = buildContext();
    generateVideoMock.mockImplementation(rejectOnAbort);
    const { writer, write } = buildWriter();

    const running = runVideoGeneration(ctx, writer);
    await vi.advanceTimersByTimeAsync(KEEPALIVE_INTERVAL_MS);
    ctx.turnAbort.requestAbort();
    await running;
    const writesAtStop = write.mock.calls.length;
    await vi.advanceTimersByTimeAsync(KEEPALIVE_INTERVAL_MS * 3);

    expect(mediaStatuses(write).at(-1)).toBe("stopped");
    expect(write.mock.calls).toHaveLength(writesAtStop);
    expect(ctx.turnOutcome).toBe("aborted");
    expect(uploadGeneratedVideoMock).not.toHaveBeenCalled();
    expect(saveDocumentMock).not.toHaveBeenCalled();
    expect(chargeUsageSafeMock).not.toHaveBeenCalled();
    expect(console.info).toHaveBeenCalledWith(
      "[media-stop]",
      expect.objectContaining({ mediaType: "video", chatId: "chat-1" })
    );
  });

  it("writes an error card for a failure that is not a stop", async () => {
    const ctx = buildContext();
    generateVideoMock.mockRejectedValue(new Error("provider down"));
    const { writer, write } = buildWriter();

    await runVideoGeneration(ctx, writer);

    expect(mediaStatuses(write)).toEqual(["generating", "error"]);
    expect(ctx.turnOutcome).toBe("completed");
    expect(chargeUsageSafeMock).not.toHaveBeenCalled();
  });

  it("writes an error card instead of ending silently when no video comes back", async () => {
    const ctx = buildContext();
    generateVideoMock.mockResolvedValue({ video: undefined });
    const { writer, write } = buildWriter();

    await runVideoGeneration(ctx, writer);

    expect(mediaStatuses(write)).toEqual(["generating", "error"]);
    expect(ctx.turnOutcome).toBe("completed");
    expect(saveDocumentMock).not.toHaveBeenCalled();
  });

  it("delivers and charges a video that arrived before the stop was honoured", async () => {
    const ctx = buildContext();
    generateVideoMock.mockResolvedValue({
      video: { uint8Array: new Uint8Array([1]) },
      providerMetadata: { gateway: { cost: "0.5" } },
    });
    uploadGeneratedVideoMock.mockImplementation(() => {
      ctx.turnAbort.requestAbort();
      return Promise.resolve("https://blob.example/v.mp4");
    });
    const { writer, write } = buildWriter();

    await runVideoGeneration(ctx, writer);

    expect(mediaStatuses(write)).toEqual(["generating", "done"]);
    expect(saveDocumentMock).toHaveBeenCalledTimes(1);
    expect(chargeUsageSafeMock).toHaveBeenCalledWith(
      expect.objectContaining({ usdCost: 0.5 }),
      expect.any(String)
    );
    expect(ctx.turnOutcome).toBe("completed");
  });
});
