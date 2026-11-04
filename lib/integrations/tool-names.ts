import { createHash } from "node:crypto";

const MCP_PREFIX = "mcp_";
const MCP_PART_PREFIX = `tool-${MCP_PREFIX}`;
const MAX_TOOL_NAME_LENGTH = 64;
const HASH_LENGTH = 6;

const sanitizeSegment = (value: string): string =>
  value.replace(/[^a-zA-Z0-9_]/g, "_");

const shortHash = (value: string, salt = ""): string =>
  createHash("sha256")
    .update(salt ? `${salt}:${value}` : value)
    .digest("hex")
    .slice(0, HASH_LENGTH);

const withHashSuffix = (base: string, hash: string): string =>
  `${base.slice(0, MAX_TOOL_NAME_LENGTH - HASH_LENGTH - 1)}_${hash}`;

/**
 * Builds the model-facing tool name `mcp_<slug>__<name>`.
 * The slug must come from the catalog id (built-ins) or `c<6 hex of connection id>`
 * (custom) — never from user text. Names are limited to `[a-zA-Z0-9_]` and 64 chars;
 * truncated or colliding names get a 6-hex suffix derived from the original name.
 */
export function toModelToolName({
  slug,
  originalName,
  taken,
}: {
  slug: string;
  originalName: string;
  taken: ReadonlySet<string>;
}): string {
  const base = `${MCP_PREFIX}${sanitizeSegment(slug)}__${sanitizeSegment(originalName)}`;
  if (base.length <= MAX_TOOL_NAME_LENGTH && !taken.has(base)) {
    return base;
  }

  let candidate = withHashSuffix(base, shortHash(originalName));
  // Distinct originals sanitise to the same base (e.g. "a-b" and "a.b"); the hash
  // of the original separates them, a salted rehash covers the vanishing remainder.
  for (let attempt = 1; taken.has(candidate); attempt++) {
    candidate = withHashSuffix(base, shortHash(originalName, String(attempt)));
  }
  return candidate;
}

export function isMcpToolName(name: string): boolean {
  return name.startsWith(MCP_PREFIX);
}

/** `tool-mcp_<...>` UI part type -> model tool name, or null for any other part type. */
export function parseMcpPartType(type: string): string | null {
  return type.startsWith(MCP_PART_PREFIX) ? type.slice("tool-".length) : null;
}
