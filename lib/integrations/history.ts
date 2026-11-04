import { parseMcpPartType } from "./tool-names";

export const HISTORY_OUTPUT_CHARS = 600;
const RECENT_USER_TURNS = 2;
const NO_RESULT = "no result";
const HISTORY_TRUNCATED_MARKER = "\n[output truncated]";
const SLUG_SEPARATOR = "__";
const HIGH_SURROGATE = /[\uD800-\uDBFF]$/;

type HistoryPart = { type: string; [key: string]: unknown };
type HistoryMessage = { role: string; parts: HistoryPart[] };

const clip = (value: string): string =>
  value.slice(0, HISTORY_OUTPUT_CHARS).replace(HIGH_SURROGATE, "");

const isMcpPart = (part: HistoryPart): boolean =>
  parseMcpPartType(part.type) !== null;

export function hasMcpParts(messages: readonly HistoryMessage[]): boolean {
  return messages.some((message) => message.parts.some(isMcpPart));
}

const outputToText = (output: unknown): string => {
  if (typeof output === "string") {
    return output;
  }
  if (output && typeof output === "object") {
    const message = (output as { message?: unknown }).message;
    return typeof message === "string" ? message : JSON.stringify(output);
  }
  return "";
};

/** `mcp_<slug>__<tool>` -> its two readable halves. */
const splitToolName = (name: string): { slug: string; tool: string } => {
  const body = name.slice("mcp_".length);
  const at = body.indexOf(SLUG_SEPARATOR);
  return at === -1
    ? { slug: body, tool: body }
    : { slug: body.slice(0, at), tool: body.slice(at + SLUG_SEPARATOR.length) };
};

/**
 * Replaces MCP tool parts the model cannot be shown as tool calls (the tool is not
 * defined this turn, or the model has no MCP support) with a plain text summary,
 * so providers never see a tool call for an undefined tool.
 * `integrationLabel` maps the tool-name slug to a display label (defaults to the slug).
 */
export function flattenOrphans<T extends HistoryMessage>(
  messages: readonly T[],
  options: {
    activeToolNames: ReadonlySet<string>;
    modelSupportsMcp: boolean;
    integrationLabel?: (slug: string) => string;
  }
): readonly T[] | T[] {
  const { activeToolNames, modelSupportsMcp, integrationLabel } = options;
  if (!hasMcpParts(messages)) {
    return messages;
  }

  const isOrphan = (name: string): boolean =>
    !modelSupportsMcp || !activeToolNames.has(name);

  return messages.map((message) => {
    const needsFlatten = message.parts.some((part) => {
      const name = parseMcpPartType(part.type);
      return name !== null && isOrphan(name);
    });
    if (!needsFlatten) {
      return message;
    }
    const parts = message.parts.map((part): HistoryPart => {
      const name = parseMcpPartType(part.type);
      if (name === null || !isOrphan(name)) {
        return part;
      }
      const { slug, tool } = splitToolName(name);
      const label = integrationLabel ? integrationLabel(slug) : slug;
      const output = clip(outputToText(part.output)) || NO_RESULT;
      return { type: "text", text: `[${label} · ${tool}: ${output}]` };
    });
    return { ...message, parts };
  });
}

/** Truncates MCP outputs older than the last two user turns. */
export function compactMcpHistory<T extends HistoryMessage>(
  messages: readonly T[]
): readonly T[] | T[] {
  if (!hasMcpParts(messages)) {
    return messages;
  }

  let seenUserTurns = 0;
  let boundary = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      seenUserTurns++;
      if (seenUserTurns === RECENT_USER_TURNS) {
        boundary = i;
        break;
      }
    }
  }

  return messages.map((message, index) => {
    if (index >= boundary) {
      return message;
    }
    const parts = message.parts.map((part): HistoryPart => {
      if (
        !isMcpPart(part) ||
        typeof part.output !== "string" ||
        part.output.length <= HISTORY_OUTPUT_CHARS
      ) {
        return part;
      }
      return {
        ...part,
        output: `${clip(part.output)}${HISTORY_TRUNCATED_MARKER}`,
      };
    });
    return { ...message, parts };
  });
}
