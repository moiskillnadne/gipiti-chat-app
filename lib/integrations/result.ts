import type { CallToolResult } from "@ai-sdk/mcp";

export const MAX_OUTPUT_CHARS = 8000;
export const MAX_ERROR_MESSAGE_CHARS = 500;

const OUTPUT_TRUNCATED_MARKER = `\n[output truncated at ${MAX_OUTPUT_CHARS} characters]`;
const UNKNOWN_MIME = "unknown";
const UNKNOWN_ERROR = "The tool reported an error";

export type McpToolError = {
  ok: false;
  error: "tool_error";
  message: string;
};

export type McpToolOutput = string | McpToolError;

const HIGH_SURROGATE = /[\uD800-\uDBFF]$/;

const truncate = (value: string, max: number): string =>
  value.length <= max ? value : value.slice(0, max).replace(HIGH_SURROGATE, "");

type ContentItem = Record<string, unknown>;

const isRecord = (value: unknown): value is ContentItem =>
  typeof value === "object" && value !== null;

const mimeOf = (item: ContentItem): string => {
  if (typeof item.mimeType === "string") {
    return item.mimeType;
  }
  const embedded = item.resource;
  if (isRecord(embedded) && typeof embedded.mimeType === "string") {
    return embedded.mimeType;
  }
  return UNKNOWN_MIME;
};

const contentToText = (result: CallToolResult): string => {
  if (!("content" in result) || !Array.isArray(result.content)) {
    return "";
  }
  const parts: string[] = [];
  for (const item of result.content as unknown[]) {
    if (!isRecord(item)) {
      continue;
    }
    if (item.type === "text" && typeof item.text === "string") {
      parts.push(item.text);
    } else {
      parts.push(`[non-text content omitted: ${mimeOf(item)}]`);
    }
  }
  return parts.join("\n");
};

/**
 * Maps an MCP `CallToolResult` to bounded text for the model. Only text content is
 * kept; images, audio and resources are replaced by a placeholder naming the mime type.
 */
export function toModelOutput(result: CallToolResult): McpToolOutput {
  const text = contentToText(result);

  if ("isError" in result && result.isError) {
    return {
      ok: false,
      error: "tool_error",
      message: truncate(text.trim() || UNKNOWN_ERROR, MAX_ERROR_MESSAGE_CHARS),
    };
  }

  if (text.length > MAX_OUTPUT_CHARS) {
    return truncate(text, MAX_OUTPUT_CHARS) + OUTPUT_TRUNCATED_MARKER;
  }
  return text;
}
