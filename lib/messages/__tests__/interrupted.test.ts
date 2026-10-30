import { describe, expect, it } from "vitest";
import type { ChatMessage } from "@/lib/types";
import {
  finalizeInterruptedMessage,
  finalizeMediaGenerationParts,
  isInterruptedMessage,
  markLastAssistantInterrupted,
  markLastAssistantStopped,
} from "../interrupted";

const assistant = (parts: unknown[]): ChatMessage =>
  ({ id: "a1", role: "assistant", parts }) as unknown as ChatMessage;

const user = (text: string): ChatMessage =>
  ({
    id: "u1",
    role: "user",
    parts: [{ type: "text", text }],
  }) as unknown as ChatMessage;

const MARK = { type: "data-interrupted", data: { reason: "user" } };

describe("isInterruptedMessage", () => {
  it("detects the mark", () => {
    expect(isInterruptedMessage(assistant([MARK]))).toBe(true);
  });

  it("is false without the mark", () => {
    expect(
      isInterruptedMessage(assistant([{ type: "text", text: "hi" }]))
    ).toBe(false);
  });
});

describe("finalizeInterruptedMessage", () => {
  it("closes streaming text and reasoning parts and appends the mark", () => {
    const result = finalizeInterruptedMessage(
      assistant([
        { type: "reasoning", text: "thinking", state: "streaming" },
        { type: "text", text: "partial", state: "streaming" },
      ])
    );

    expect(result.parts).toEqual([
      { type: "reasoning", text: "thinking", state: "done" },
      { type: "text", text: "partial", state: "done" },
      MARK,
    ]);
  });

  it("drops tool calls that have no result yet", () => {
    const result = finalizeInterruptedMessage(
      assistant([
        { type: "text", text: "a", state: "done" },
        { type: "tool-webSearch", toolCallId: "1", state: "input-streaming" },
        { type: "tool-calculator", toolCallId: "2", state: "input-available" },
        { type: "dynamic-tool", toolCallId: "3", state: "input-available" },
      ])
    );

    expect(result.parts.map((p) => p.type)).toEqual([
      "text",
      "data-interrupted",
    ]);
  });

  it("keeps finished tool calls", () => {
    const finished = {
      type: "tool-calculator",
      toolCallId: "2",
      state: "output-available",
      input: {},
      output: 1,
    };
    const result = finalizeInterruptedMessage(assistant([finished]));

    expect(result.parts).toEqual([finished, MARK]);
  });

  it("marks a message with no content at all", () => {
    const result = finalizeInterruptedMessage(
      assistant([{ type: "data-modelId", data: "m" }])
    );

    expect(result.parts).toEqual([{ type: "data-modelId", data: "m" }, MARK]);
  });

  it("is idempotent", () => {
    const once = finalizeInterruptedMessage(
      assistant([{ type: "text", text: "x", state: "streaming" }])
    );
    const twice = finalizeInterruptedMessage(once);

    expect(twice).toBe(once);
    expect(
      twice.parts.filter((p) => p.type === "data-interrupted")
    ).toHaveLength(1);
  });

  it("does not mutate the input", () => {
    const input = assistant([{ type: "text", text: "x", state: "streaming" }]);
    finalizeInterruptedMessage(input);

    expect(input.parts).toEqual([
      { type: "text", text: "x", state: "streaming" },
    ]);
  });
});

describe("markLastAssistantInterrupted", () => {
  it("finalizes only the trailing assistant message", () => {
    const first = assistant([
      { type: "text", text: "old", state: "streaming" },
    ]);
    const last = { ...assistant([{ type: "text", text: "new" }]), id: "a2" };
    const result = markLastAssistantInterrupted([user("q"), first, last]);

    expect(result[1]).toBe(first);
    expect(isInterruptedMessage(result[2])).toBe(true);
  });

  it("returns the input unchanged when the last message is from the user", () => {
    const messages = [assistant([]), user("q")];

    expect(markLastAssistantInterrupted(messages)).toBe(messages);
  });

  it("returns the input unchanged for an empty list", () => {
    const messages: ChatMessage[] = [];

    expect(markLastAssistantInterrupted(messages)).toBe(messages);
  });
});

const mediaCard = (status: string) => ({
  type: "data-mediaGeneration",
  id: "doc-1",
  data: {
    documentId: "doc-1",
    mediaType: "image",
    status,
    prompt: "a fox",
    modelId: "image-model",
  },
});

describe("finalizeMediaGenerationParts", () => {
  it("turns a generating card into a stopped one, keeping its id and data", () => {
    const message = assistant([mediaCard("generating")]);

    const result = finalizeMediaGenerationParts(message, "stopped");

    expect(result.parts).toEqual([mediaCard("stopped")]);
  });

  it("turns a dangling generating card into an error one", () => {
    const result = finalizeMediaGenerationParts(
      assistant([mediaCard("generating")]),
      "error"
    );

    expect(result.parts).toEqual([mediaCard("error")]);
  });

  it("leaves finished cards and other parts alone", () => {
    const message = assistant([
      { type: "text", text: "hi" },
      mediaCard("done"),
      mediaCard("generating"),
    ]);

    const result = finalizeMediaGenerationParts(message, "stopped");

    expect(result.parts).toEqual([
      { type: "text", text: "hi" },
      mediaCard("done"),
      mediaCard("stopped"),
    ]);
  });

  it("returns the same reference when nothing is generating", () => {
    const message = assistant([mediaCard("done")]);

    expect(finalizeMediaGenerationParts(message, "stopped")).toBe(message);
  });

  it("does not add the interrupted mark", () => {
    const result = finalizeMediaGenerationParts(
      assistant([mediaCard("generating")]),
      "stopped"
    );

    expect(isInterruptedMessage(result)).toBe(false);
  });
});

describe("markLastAssistantStopped", () => {
  it("stops the generating card of a media turn without the interrupted mark", () => {
    const messages = [user("draw a fox"), assistant([mediaCard("generating")])];

    const result = markLastAssistantStopped(messages);

    expect(result[0]).toBe(messages[0]);
    expect(result[1].parts).toEqual([mediaCard("stopped")]);
  });

  it("returns the same reference for a media turn that already finished", () => {
    const messages = [user("draw a fox"), assistant([mediaCard("done")])];

    expect(markLastAssistantStopped(messages)).toBe(messages);
  });

  it("marks a text turn as interrupted", () => {
    const messages = [
      user("hi"),
      assistant([{ type: "text", text: "partial", state: "streaming" }]),
    ];

    const result = markLastAssistantStopped(messages);

    expect(result[1].parts).toEqual([
      { type: "text", text: "partial", state: "done" },
      MARK,
    ]);
  });

  it("returns the same reference when the last message is the user's", () => {
    const messages = [assistant([mediaCard("generating")]), user("next")];

    expect(markLastAssistantStopped(messages)).toBe(messages);
  });

  it("returns the same reference for an empty list", () => {
    const messages: ChatMessage[] = [];

    expect(markLastAssistantStopped(messages)).toBe(messages);
  });
});
