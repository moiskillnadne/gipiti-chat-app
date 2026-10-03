import { describe, expect, it } from "vitest";
import type { ChatMessage } from "@/lib/types";
import { collectChatMedia } from "../collect-chat-media";

type ChatMessagePart = ChatMessage["parts"][number];

const CREATED_AT = "2026-10-03T10:00:00.000Z";

const buildMessage = (
  id: string,
  role: ChatMessage["role"],
  parts: unknown[]
): ChatMessage => ({
  id,
  role,
  // Tool parts carry deeply inferred generics; tests only need the runtime shape.
  parts: parts as ChatMessagePart[],
  metadata: { createdAt: CREATED_AT },
});

const userImageFile = (url: string, filename = "photo.png") => ({
  type: "file",
  mediaType: "image/png",
  url,
  filename,
});

const mediaGenerationPart = (
  url: string | undefined,
  overrides: Record<string, unknown> = {}
) => ({
  type: "data-mediaGeneration",
  data: {
    documentId: `doc-${url}`,
    mediaType: "image",
    status: "done",
    prompt: "a red fox",
    modelId: "google/gemini-3-pro-image",
    url,
    aspectRatio: "16:9",
    ...overrides,
  },
});

describe("collectChatMedia", () => {
  it("returns an empty gallery for a chat without media", () => {
    // Arrange
    const messages = [
      buildMessage("m1", "user", [{ type: "text", text: "hi" }]),
      buildMessage("m2", "assistant", [{ type: "text", text: "hello" }]),
    ];

    // Act
    const items = collectChatMedia(messages);

    // Assert
    expect(items).toEqual([]);
  });

  it("collects user image attachments with the filename as caption", () => {
    // Arrange
    const messages = [
      buildMessage("m1", "user", [
        userImageFile("https://blob/a.png", "a.png"),
      ]),
    ];

    // Act
    const items = collectChatMedia(messages);

    // Assert
    expect(items).toEqual([
      {
        key: "https://blob/a.png",
        url: "https://blob/a.png",
        mediaType: "image",
        prompt: "a.png",
        createdAt: CREATED_AT,
      },
    ]);
  });

  it("excludes non-image user attachments", () => {
    // Arrange
    const messages = [
      buildMessage("m1", "user", [
        {
          type: "file",
          mediaType: "application/pdf",
          url: "https://blob/doc.pdf",
          filename: "doc.pdf",
        },
      ]),
    ];

    // Act
    const items = collectChatMedia(messages);

    // Assert
    expect(items).toEqual([]);
  });

  it("skips assistant file parts that duplicate a generated result", () => {
    // Arrange
    const generatedUrl = "https://blob/generated.png";
    const messages = [
      buildMessage("m1", "assistant", [
        mediaGenerationPart(generatedUrl),
        { type: "file", mediaType: "image/png", url: generatedUrl },
        {
          type: "file",
          mediaType: "image/png",
          url: "https://blob/assistant-only.png",
        },
      ]),
    ];

    // Act
    const items = collectChatMedia(messages);

    // Assert
    expect(items.map((item) => item.url)).toEqual([generatedUrl]);
  });

  it("maps finished media generations with model and aspect metadata", () => {
    // Arrange
    const messages = [
      buildMessage("m1", "assistant", [
        mediaGenerationPart("https://blob/video.mp4", { mediaType: "video" }),
      ]),
    ];

    // Act
    const [item] = collectChatMedia(messages);

    // Assert
    expect(item).toEqual({
      key: "https://blob/video.mp4",
      url: "https://blob/video.mp4",
      mediaType: "video",
      prompt: "a red fox",
      modelId: "google/gemini-3-pro-image",
      aspectRatio: "16:9",
      createdAt: CREATED_AT,
    });
  });

  it("excludes generations that are still running or failed", () => {
    // Arrange
    const messages = [
      buildMessage("m1", "assistant", [
        mediaGenerationPart(undefined, { status: "generating" }),
        mediaGenerationPart("https://blob/err.png", { status: "error" }),
        {
          type: "tool-generateImage",
          toolCallId: "call-1",
          state: "input-available",
          input: { prompt: "pending", modelId: "x" },
        },
      ]),
    ];

    // Act
    const items = collectChatMedia(messages);

    // Assert
    expect(items).toEqual([]);
  });

  it("collects finished generateImage tool output with its prompt", () => {
    // Arrange
    const messages = [
      buildMessage("m1", "assistant", [
        {
          type: "tool-generateImage",
          toolCallId: "call-1",
          state: "output-available",
          input: { prompt: "a cat", modelId: "chat-chosen-id" },
          output: { id: "img-1", imageUrl: "https://blob/cat.png" },
        },
      ]),
    ];

    // Act
    const [item] = collectChatMedia(messages);

    // Assert
    expect(item).toMatchObject({
      url: "https://blob/cat.png",
      mediaType: "image",
      prompt: "a cat",
    });
    expect(item.modelId).toBeUndefined();
  });

  it("maps legacy image and video finish parts", () => {
    // Arrange
    const messages = [
      buildMessage("m1", "assistant", [
        {
          type: "data-imageGenerationFinish",
          data: {
            responseId: "r1",
            imageUrl: "https://blob/legacy.png",
            userPrompt: "old image",
            usageMetadata: {},
          },
        },
        {
          type: "data-videoGenerationFinish",
          data: {
            responseId: "r2",
            videoUrl: "https://blob/legacy.mp4",
            userPrompt: "old video",
            durationSeconds: 8,
          },
        },
      ]),
    ];

    // Act
    const items = collectChatMedia(messages);

    // Assert
    expect(
      items.map(({ url, mediaType, prompt }) => ({ url, mediaType, prompt }))
    ).toEqual([
      {
        url: "https://blob/legacy.png",
        mediaType: "image",
        prompt: "old image",
      },
      {
        url: "https://blob/legacy.mp4",
        mediaType: "video",
        prompt: "old video",
      },
    ]);
  });

  it("keeps chat order across messages and dedupes repeated URLs", () => {
    // Arrange
    const messages = [
      buildMessage("m1", "user", [userImageFile("https://blob/1.png")]),
      buildMessage("m2", "assistant", [
        mediaGenerationPart("https://blob/2.png"),
      ]),
      buildMessage("m3", "user", [
        userImageFile("https://blob/1.png"),
        userImageFile("https://blob/3.png"),
      ]),
    ];

    // Act
    const items = collectChatMedia(messages);

    // Assert
    expect(items.map((item) => item.url)).toEqual([
      "https://blob/1.png",
      "https://blob/2.png",
      "https://blob/3.png",
    ]);
  });
});
