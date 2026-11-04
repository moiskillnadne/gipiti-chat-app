import type { ListToolsResult, MCPClient } from "@ai-sdk/mcp";

import type { ToolSnapshotEntry } from "@/lib/db/schema";
import type { CatalogEntry } from "./catalog";
import { openMcpClient } from "./client";
import { normalizeInputSchema } from "./json-schema";
import {
  hashDefinitions,
  MAX_SCHEMA_BYTES,
  sanitizeDefinition,
} from "./sanitize";
import { toModelToolName } from "./tool-names";

const MAX_LIST_PAGES = 10;
const CHARS_PER_TOKEN = 4;
const CUSTOM_SLUG_HEX_LENGTH = 6;

export type CustomSnapshotConfig = {
  connectionId: string;
  serverUrl: string;
};

export type CaptureToolSnapshotInput = {
  headers?: Record<string, string>;
  fetch?: typeof globalThis.fetch;
  signal?: AbortSignal;
  /** Injected in tests; defaults to the real client factory. */
  openClient?: typeof openMcpClient;
} & (
  | { entry: CatalogEntry; customConfig?: undefined }
  | { entry?: undefined; customConfig: CustomSnapshotConfig }
);

export type ToolSnapshot = {
  snapshot: ToolSnapshotEntry[];
  hash: string;
  tokenEstimate: number;
  /** Allowlisted tool names the server no longer reports (vendor renames). */
  missingAllowlisted: string[];
};

type ServerTool = ListToolsResult["tools"][number];

const listAllTools = async (client: MCPClient): Promise<ServerTool[]> => {
  const tools: ServerTool[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_LIST_PAGES; page++) {
    const result = await client.listTools(
      cursor ? { params: { cursor } } : undefined
    );
    tools.push(...result.tools);
    cursor = result.nextCursor;
    if (!cursor) {
      break;
    }
  }
  return tools;
};

const customSlug = (connectionId: string): string =>
  `c${connectionId.replace(/-/g, "").slice(0, CUSTOM_SLUG_HEX_LENGTH)}`;

const estimateTokens = (snapshot: readonly ToolSnapshotEntry[]): number => {
  const chars = snapshot.reduce(
    (sum, tool) =>
      sum +
      tool.name.length +
      tool.description.length +
      JSON.stringify(tool.inputSchema).length,
    0
  );
  return Math.ceil(chars / CHARS_PER_TOKEN);
};

/**
 * Runs `tools/list`, keeps the allowlisted tools (custom servers: all), sanitises and
 * normalises each definition and assigns its stable model-facing name. Built-ins use our
 * own descriptions; custom servers' descriptions are sanitised server text, and their
 * tools are classed `write` until the user marks them read-only.
 */
export async function captureToolSnapshot(
  input: CaptureToolSnapshotInput
): Promise<ToolSnapshot> {
  const { entry, customConfig, headers, fetch, signal } = input;
  const openClient = input.openClient ?? openMcpClient;
  const serverUrl = entry ? entry.serverUrl : customConfig.serverUrl;
  const slug = entry ? entry.id : customSlug(customConfig.connectionId);

  const client = await openClient({ serverUrl, headers, fetch, signal });
  let serverTools: ServerTool[];
  try {
    serverTools = await listAllTools(client);
  } finally {
    try {
      await client.close();
    } catch {
      // A failed close must not mask the listing result or error.
    }
  }

  const byName = new Map(serverTools.map((tool) => [tool.name, tool]));
  const missingAllowlisted = entry
    ? Object.keys(entry.tools).filter((name) => !byName.has(name))
    : [];

  const selected = [...byName.values()]
    .filter((tool) => !entry || tool.name in entry.tools)
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  const taken = new Set<string>();
  const snapshot: ToolSnapshotEntry[] = [];
  for (const tool of selected) {
    const catalogTool = entry?.tools[tool.name];
    const sanitized = sanitizeDefinition({
      name: tool.name,
      description: catalogTool?.description ?? tool.description ?? "",
      inputSchema: tool.inputSchema,
    });
    if (!sanitized.ok) {
      continue;
    }
    const normalized = normalizeInputSchema(sanitized.definition.inputSchema);
    if (
      !normalized.ok ||
      Buffer.byteLength(JSON.stringify(normalized.schema), "utf8") >
        MAX_SCHEMA_BYTES
    ) {
      continue;
    }

    const name = toModelToolName({ slug, originalName: tool.name, taken });
    taken.add(name);
    snapshot.push({
      name,
      originalName: tool.name,
      description: sanitized.definition.description,
      inputSchema: normalized.schema,
      toolClass: catalogTool?.toolClass ?? "write",
    });
  }

  return {
    snapshot,
    hash: hashDefinitions(
      snapshot.map(({ name, description, inputSchema }) => ({
        name,
        description,
        inputSchema,
      }))
    ),
    tokenEstimate: estimateTokens(snapshot),
    missingAllowlisted,
  };
}
