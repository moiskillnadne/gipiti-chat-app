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

const isEmptyReasoning = (part: ChatMessagePart): boolean =>
  part.type === "reasoning" && !part.text?.trim();

/**
 * Walks an assistant message's parts and bundles ALL reasoning + tool parts
 * into a single `run-group` synthetic part, regardless of any text/file/data-*
 * parts interleaved between them. The combined group is inserted at the
 * position of the first tool/reasoning part; subsequent run parts are absorbed
 * into that same group. All other parts (text, file, data-*) pass through in
 * their original order. Empty reasoning parts are dropped.
 */
export const groupToolRuns = (
  parts: ChatMessage["parts"]
): GroupedMessagePart[] => {
  const runParts: ChatMessagePart[] = [];
  let firstRunIndex = -1;

  parts.forEach((part, index) => {
    if (isEmptyReasoning(part)) {
      return;
    }
    if (isRunPart(part)) {
      if (firstRunIndex === -1) {
        firstRunIndex = index;
      }
      runParts.push(part);
    }
  });

  if (runParts.length === 0) {
    return parts.filter((part) => !isEmptyReasoning(part));
  }

  const group: RunGroupPart = {
    type: "run-group",
    key: "run-group-0",
    parts: runParts,
  };

  const result: GroupedMessagePart[] = [];
  parts.forEach((part, index) => {
    if (isEmptyReasoning(part)) {
      return;
    }
    if (isRunPart(part)) {
      if (index === firstRunIndex) {
        result.push(group);
      }
      return;
    }
    result.push(part);
  });

  return result;
};
