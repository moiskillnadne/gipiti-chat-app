import type { IntegrationErrorCode } from "./turn-plan";

const MCP_PART_PREFIX = "tool-mcp_";
const SLUG_SEPARATOR = "__";
const CUSTOM_SLUG = /^c[0-9a-f]{6}$/;
const SELECTION_KEY_PREFIX = "integrations:";
export const MAX_SELECTED_INTEGRATIONS = 5;

/** Error codes the run-card has a dedicated message for. */
export const KNOWN_ERROR_CODES: readonly (
  | IntegrationErrorCode
  | "tool_error"
)[] = [
  "budget_exceeded",
  "cancelled_by_user",
  "timeout",
  "connect_failed",
  "unauthorized",
  "tool_error",
];

export type McpPartName = {
  /** Catalog id for built-ins, `custom` for user-supplied servers. */
  integration: string;
  tool: string;
};

/** `tool-mcp_<slug>__<tool>` -> its slug and tool, or null for any other part type. */
export function parseMcpPartName(type: string): McpPartName | null {
  if (!type.startsWith(MCP_PART_PREFIX)) {
    return null;
  }
  const rest = type.slice(MCP_PART_PREFIX.length);
  const at = rest.indexOf(SLUG_SEPARATOR);
  if (at <= 0) {
    return null;
  }
  const slug = rest.slice(0, at);
  return {
    integration: CUSTOM_SLUG.test(slug) ? "custom" : slug,
    tool: rest.slice(at + SLUG_SEPARATOR.length),
  };
}

export type McpFailure = { code: string; message?: string };

/** Reads the `{ ok: false, error }` shape an MCP tool resolves with; null on success. */
export function readMcpFailure(output: unknown): McpFailure | null {
  if (typeof output !== "object" || output === null) {
    return null;
  }
  const record = output as Record<string, unknown>;
  if (record.ok !== false) {
    return null;
  }
  return {
    code: typeof record.error === "string" ? record.error : "tool_error",
    message: typeof record.message === "string" ? record.message : undefined,
  };
}

export const selectionStorageKey = (chatId: string): string =>
  `${SELECTION_KEY_PREFIX}${chatId}`;

/** Tolerant parse of the stored selection: anything unexpected yields []. */
export function parseStoredSelection(raw: string | null): string[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((value): value is string => typeof value === "string")
      .slice(0, MAX_SELECTED_INTEGRATIONS);
  } catch {
    return [];
  }
}
