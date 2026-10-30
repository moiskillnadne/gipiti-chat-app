import { isToolUIPart } from "ai";
import type { ChatMessage } from "@/lib/types";

type ChatPart = ChatMessage["parts"][number];

/** Tool states that never got a result: the call was cut off mid-flight. */
const INCOMPLETE_TOOL_STATES = new Set(["input-streaming", "input-available"]);

/** True when the message carries the "stopped by user" data part. */
export function isInterruptedMessage(message: ChatMessage): boolean {
  return message.parts.some((part) => part.type === "data-interrupted");
}

const isIncompleteToolPart = (part: ChatPart): boolean =>
  isToolUIPart(part) && INCOMPLETE_TOOL_STATES.has(part.state);

/**
 * Make a message cut off by a user stop safe to persist and replay: tool calls
 * that never produced a result are dropped (providers reject dangling calls),
 * streaming text/reasoning parts are closed, and the interrupted mark is
 * appended. Idempotent — an already marked message is returned unchanged.
 */
export function finalizeInterruptedMessage(message: ChatMessage): ChatMessage {
  if (isInterruptedMessage(message)) {
    return message;
  }

  const parts = message.parts
    .filter((part) => !isIncompleteToolPart(part))
    .map((part): ChatPart => {
      if (
        (part.type === "text" || part.type === "reasoning") &&
        part.state === "streaming"
      ) {
        return { ...part, state: "done" };
      }
      return part;
    });

  return {
    ...message,
    parts: [...parts, { type: "data-interrupted", data: { reason: "user" } }],
  };
}

/**
 * Mark the trailing assistant message as interrupted. Anything else (empty
 * list, trailing user message) is returned as-is, same reference.
 */
export function markLastAssistantInterrupted(
  messages: ChatMessage[]
): ChatMessage[] {
  const last = messages.at(-1);
  if (!last || last.role !== "assistant") {
    return messages;
  }
  return [...messages.slice(0, -1), finalizeInterruptedMessage(last)];
}
