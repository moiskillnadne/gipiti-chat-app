import type { ChatMessage } from "@/lib/types";

type ChatMessagePart = ChatMessage["parts"][number];

const TOOL_PART_TYPE_PREFIX = "tool-";

/**
 * A synthetic group emitted by `groupToolRuns` to bundle consecutive
 * reasoning + tool parts into a single render unit (the unified "tool run" card).
 */
export type RunGroupPart = {
  type: "run-group";
  key: string;
  parts: ChatMessagePart[];
};

export type GroupedMessagePart = ChatMessagePart | RunGroupPart;

/**
 * Returns true for parts that should fold into a tool-run card:
 * any `tool-*` part, plus `reasoning` parts that have non-empty text.
 */
const isRunPart = (part: ChatMessagePart): boolean => {
  if (part.type === "reasoning") {
    return Boolean(part.text?.trim());
  }
  return part.type.startsWith(TOOL_PART_TYPE_PREFIX);
};

/**
 * Walks an assistant message's parts and bundles consecutive reasoning + tool
 * parts into `run-group` synthetic parts. Empty reasoning parts are dropped
 * (matching the existing filter in `components/message.tsx`). All other parts
 * (text, file, data-*) pass through unchanged in their original order.
 */
export const groupToolRuns = (
  parts: ChatMessage["parts"]
): GroupedMessagePart[] => {
  const result: GroupedMessagePart[] = [];
  let currentGroup: ChatMessagePart[] | null = null;
  let groupIndex = 0;

  const flush = () => {
    if (currentGroup && currentGroup.length > 0) {
      result.push({
        type: "run-group",
        key: `run-group-${groupIndex}`,
        parts: currentGroup,
      });
      groupIndex += 1;
    }
    currentGroup = null;
  };

  for (const part of parts) {
    if (part.type === "reasoning" && !part.text?.trim()) {
      continue;
    }

    if (isRunPart(part)) {
      if (!currentGroup) {
        currentGroup = [];
      }
      currentGroup.push(part);
      continue;
    }

    flush();
    result.push(part);
  }

  flush();
  return result;
};
