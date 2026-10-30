import { describe, expect, it } from "vitest";
import type { ChatMessage } from "@/lib/types";
import {
  finalizeInterruptedMessage,
  isInterruptedMessage,
  markLastAssistantInterrupted,
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
