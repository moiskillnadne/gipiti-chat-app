import { createHash } from "node:crypto";
import type { JSONSchema7 } from "@ai-sdk/provider";

export const MAX_DESCRIPTION_LENGTH = 1000;
export const MAX_SCHEMA_BYTES = 4096;

// \p{Cf}: zero-width, bidi marks/overrides/isolates and the U+E0000-E007F tag block
// (hidden-prompt payloads). \p{Cc}: C0/C1 controls, except \n and \t.
const INVISIBLE_CHARS = /[\p{Cf}]|(?![\n\t])\p{Cc}/gu;

export type DefinitionInput = {
  name: string;
  description: string;
  inputSchema: JSONSchema7;
};

export type SanitizeResult =
  | { ok: true; definition: DefinitionInput }
  | { ok: false; reason: string };

const stripInvisible = (value: string): string =>
  value.replace(INVISIBLE_CHARS, "");

const sanitizeDeep = (value: unknown): unknown => {
  if (typeof value === "string") {
    return stripInvisible(value);
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeDeep);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        stripInvisible(key),
        sanitizeDeep(entry),
      ])
    );
  }
  return value;
};

export function sanitizeDefinition(input: DefinitionInput): SanitizeResult {
  const name = stripInvisible(input.name).trim();
  if (!name) {
    return { ok: false, reason: "empty_name" };
  }

  const description = Array.from(stripInvisible(input.description))
    .slice(0, MAX_DESCRIPTION_LENGTH)
    .join("");

  const inputSchema = sanitizeDeep(input.inputSchema) as JSONSchema7;
  const schemaBytes = Buffer.byteLength(JSON.stringify(inputSchema), "utf8");
  if (schemaBytes > MAX_SCHEMA_BYTES) {
    return { ok: false, reason: "schema_too_large" };
  }

  return { ok: true, definition: { name, description, inputSchema } };
}

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, entry]) => [key, canonicalize(entry)])
    );
  }
  return value;
};

/** sha256 over canonical JSON of (name, description, schema), sorted by name. */
export function hashDefinitions(entries: readonly DefinitionInput[]): string {
  const sorted = [...entries]
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .map((entry) =>
      canonicalize({
        name: entry.name,
        description: entry.description,
        inputSchema: entry.inputSchema,
      })
    );
  return createHash("sha256").update(JSON.stringify(sorted)).digest("hex");
}
