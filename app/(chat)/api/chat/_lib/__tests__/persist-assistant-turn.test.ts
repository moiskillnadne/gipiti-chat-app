import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatMessage } from "@/lib/types";
import type { ChatTurnContext } from "../context";

const { saveMessagesMock, getMessageByIdMock } = vi.hoisted(() => ({
  saveMessagesMock: vi.fn(),
  getMessageByIdMock: vi.fn(),
}));

vi.mock("@/lib/db/query/chat/save-messages", () => ({
  saveMessages: saveMessagesMock,
}));
vi.mock("@/lib/db/query/chat/get-message-by-id", () => ({
  getMessageById: getMessageByIdMock,
}));
vi.mock("@/lib/db/query/chat/update-chat-last-context-by-id", () => ({
  updateChatLastContextById: vi.fn(),
}));

import { persistAssistantTurn } from "../persist-assistant-turn";

const USER_MESSAGE_CREATED_AT = new Date("2026-10-30T10:00:00.000Z");
const FINISHED_AT = new Date("2026-10-30T10:00:05.000Z");

const buildContext = (finalMediaPart?: unknown): ChatTurnContext =>
  ({
    chatId: "chat-1",
    model: "test-model",
    stepLimit: 5,
    message: { id: "user-message-1" },
    userMessageCreatedAt: USER_MESSAGE_CREATED_AT,
    lastUsage: {},
    finalMediaPart,
  }) as unknown as ChatTurnContext;

const ctx = buildContext();

const mediaCard = (status: string) => ({
  type: "data-mediaGeneration",
  id: "doc-1",
  data: { documentId: "doc-1", mediaType: "video", status },
});

const assistantMessage = (parts: unknown[]): ChatMessage =>
  ({ id: "assistant-1", role: "assistant", parts }) as unknown as ChatMessage;

const savedAssistantParts = (): unknown[] => {
  const [{ messages }] = saveMessagesMock.mock.calls[0];
  return messages.find(
    (message: { role: string }) => message.role === "assistant"
  ).parts;
};

describe("persistAssistantTurn", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    saveMessagesMock.mockResolvedValue(undefined);
    getMessageByIdMock.mockResolvedValue([
      { createdAt: USER_MESSAGE_CREATED_AT },
    ]);
  });

  it("saves an aborted media turn with its generating card stopped", async () => {
    const messages = [assistantMessage([mediaCard("generating")])];

    await persistAssistantTurn(ctx, messages, "video", {
      aborted: true,
      finishedAt: FINISHED_AT,
    });

    expect(savedAssistantParts()).toEqual([mediaCard("stopped")]);
  });

  it("closes a dangling generating card of a non-aborted media turn as an error", async () => {
    const messages = [assistantMessage([mediaCard("generating")])];

    await persistAssistantTurn(ctx, messages, "image", {
      aborted: false,
      finishedAt: FINISHED_AT,
    });

    expect(savedAssistantParts()).toEqual([mediaCard("error")]);
  });

  it("keeps a finished media card as it is", async () => {
    const messages = [assistantMessage([mediaCard("done")])];

    await persistAssistantTurn(ctx, messages, "video", {
      aborted: true,
      finishedAt: FINISHED_AT,
    });

    expect(savedAssistantParts()).toEqual([mediaCard("done")]);
  });

  it("drops an aborted media turn whose user message was edited meanwhile", async () => {
    getMessageByIdMock.mockResolvedValue([]);
    const messages = [assistantMessage([mediaCard("generating")])];

    await persistAssistantTurn(ctx, messages, "video", {
      aborted: true,
      finishedAt: FINISHED_AT,
    });

    expect(saveMessagesMock).not.toHaveBeenCalled();
  });

  it("does not look up the user message for a turn that was not aborted", async () => {
    const messages = [assistantMessage([mediaCard("done")])];

    await persistAssistantTurn(ctx, messages, "image", {
      aborted: false,
      finishedAt: FINISHED_AT,
    });

    expect(getMessageByIdMock).not.toHaveBeenCalled();
  });

  it("persists the handler's done card over a generating snapshot of a cancelled response", async () => {
    // The response was cancelled while the handler was still saving; the
    // handler finished with a result, so the turn is not counted as aborted.
    const turnContext = buildContext(mediaCard("done"));
    const messages = [assistantMessage([mediaCard("generating")])];

    await persistAssistantTurn(turnContext, messages, "video", {
      aborted: false,
      finishedAt: FINISHED_AT,
    });

    expect(savedAssistantParts()).toEqual([mediaCard("done")]);
  });

  it("keeps the handler's done card even when the turn is flagged aborted", async () => {
    const turnContext = buildContext(mediaCard("done"));
    const messages = [assistantMessage([mediaCard("generating")])];

    await persistAssistantTurn(turnContext, messages, "image", {
      aborted: true,
      finishedAt: FINISHED_AT,
    });

    expect(savedAssistantParts()).toEqual([mediaCard("done")]);
  });

  it("appends the handler's final card when the snapshot lacks it", async () => {
    const turnContext = buildContext(mediaCard("done"));
    const messages = [
      assistantMessage([{ type: "data-modelId", data: "test-model" }]),
    ];

    await persistAssistantTurn(turnContext, messages, "image", {
      aborted: false,
      finishedAt: FINISHED_AT,
    });

    expect(savedAssistantParts()).toEqual([
      { type: "data-modelId", data: "test-model" },
      mediaCard("done"),
    ]);
  });

  it("re-creates the file part of a done card when the snapshot lacks it", async () => {
    const doneCard = {
      ...mediaCard("done"),
      data: { ...mediaCard("done").data, url: "https://blob.example/v.mp4" },
    };
    const turnContext = buildContext(doneCard);
    const messages = [assistantMessage([mediaCard("generating")])];

    await persistAssistantTurn(turnContext, messages, "video", {
      aborted: false,
      finishedAt: FINISHED_AT,
    });

    expect(savedAssistantParts()).toEqual([
      doneCard,
      {
        type: "file",
        mediaType: "video/mp4",
        url: "https://blob.example/v.mp4",
      },
    ]);
  });

  it("does not duplicate the file part the snapshot already has", async () => {
    const url = "https://blob.example/i.png";
    const doneCard = {
      ...mediaCard("done"),
      data: { ...mediaCard("done").data, mediaType: "image", url },
    };
    const filePart = { type: "file", mediaType: "image/png", url };
    const turnContext = buildContext(doneCard);
    const messages = [assistantMessage([mediaCard("generating"), filePart])];

    await persistAssistantTurn(turnContext, messages, "image", {
      aborted: false,
      finishedAt: FINISHED_AT,
    });

    expect(savedAssistantParts()).toEqual([doneCard, filePart]);
  });

  it("closes a final card that is still generating according to the abort flag", async () => {
    const turnContext = buildContext(mediaCard("generating"));
    const messages = [assistantMessage([mediaCard("generating")])];

    await persistAssistantTurn(turnContext, messages, "video", {
      aborted: true,
      finishedAt: FINISHED_AT,
    });

    expect(savedAssistantParts()).toEqual([mediaCard("stopped")]);
  });

  it("ignores the final media part for a text turn", async () => {
    const turnContext = buildContext(mediaCard("done"));
    const messages = [
      assistantMessage([{ type: "text", text: "answer", state: "done" }]),
    ];

    await persistAssistantTurn(turnContext, messages, "text", {
      aborted: false,
      finishedAt: FINISHED_AT,
    });

    expect(savedAssistantParts()).toEqual([
      { type: "text", text: "answer", state: "done" },
    ]);
  });

  it("marks an aborted text turn as interrupted", async () => {
    const messages = [
      assistantMessage([{ type: "text", text: "partial", state: "streaming" }]),
    ];

    await persistAssistantTurn(ctx, messages, "text", {
      aborted: true,
      finishedAt: FINISHED_AT,
    });

    expect(savedAssistantParts()).toEqual([
      { type: "text", text: "partial", state: "done" },
      { type: "data-interrupted", data: { reason: "user" } },
    ]);
  });

  it("saves a completed text turn untouched", async () => {
    const messages = [
      assistantMessage([{ type: "text", text: "answer", state: "done" }]),
    ];

    await persistAssistantTurn(ctx, messages, "text", {
      aborted: false,
      finishedAt: FINISHED_AT,
    });

    expect(savedAssistantParts()).toEqual([
      { type: "text", text: "answer", state: "done" },
    ]);
  });
});
