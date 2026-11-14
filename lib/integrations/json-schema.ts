import type { JSONSchema7 } from "@ai-sdk/provider";

const MAX_REF_DEPTH = 5;
/** Server-written property descriptions (custom servers only) are cut to this length. */
export const MAX_PROPERTY_DESCRIPTION_LENGTH = 300;
const MAX_PROPERTY_NAME_LENGTH = 64;
const MAX_LITERAL_VALUES = 50;
const MAX_LITERAL_LENGTH = 100;

// Keyword allowlist. Anything not listed here or handled structurally below is dropped, so
// `title`, `$comment`, `examples`, `default`, `format`, `pattern`, `x-*` and unknown keywords
// never reach the model. Server text can only travel through `description` (see
// `NormalizeOptions`), `enum`/`const` values and property names, all of which are capped.
const COPIED_KEYWORDS = new Set([
  "type",
  "required",
  "nullable",
  "minItems",
  "maxItems",
  "uniqueItems",
]);
const LITERAL_KEYWORDS = new Set(["enum", "const"]);
const SCHEMA_MAP_KEYWORDS = new Set(["properties", "patternProperties"]);
const SCHEMA_ARRAY_KEYWORDS = new Set(["anyOf", "oneOf", "allOf"]);
const SCHEMA_KEYWORDS = new Set([
  "items",
  "additionalProperties",
  "not",
  "if",
  "then",
  "else",
]);

type SchemaNode = Record<string, unknown>;

export type NormalizeResult =
  | { ok: true; schema: JSONSchema7 }
  | { ok: false; reason: string };

export type NormalizeOptions = {
  /**
   * What happens to server-written `description` strings inside the schema. Built-ins use
   * `"drop"` (the catalog supplies our own text); custom servers use `"keep"`, which caps each
   * one at `MAX_PROPERTY_DESCRIPTION_LENGTH`. Defaults to `"drop"`.
   */
  descriptions?: "drop" | "keep";
};

class SchemaRejected extends Error {}

const isRecord = (value: unknown): value is SchemaNode =>
  typeof value === "object" && value !== null && !Array.isArray(value);

type Context = { defs: Map<string, unknown>; keepDescriptions: boolean };

const collectDefs = (root: SchemaNode): Map<string, unknown> => {
  const defs = new Map<string, unknown>();
  for (const key of ["$defs", "definitions"]) {
    const bucket = root[key];
    if (isRecord(bucket)) {
      for (const [name, def] of Object.entries(bucket)) {
        defs.set(`#/${key}/${name}`, def);
      }
    }
  }
  return defs;
};

const capDescription = (value: string): string =>
  Array.from(value).slice(0, MAX_PROPERTY_DESCRIPTION_LENGTH).join("");

/** `enum` / `const` values reach the model verbatim, so their size is bounded. */
const assertLiteralSize = (value: unknown): void => {
  const values = Array.isArray(value) ? value : [value];
  if (values.length > MAX_LITERAL_VALUES) {
    throw new SchemaRejected("enum_too_large");
  }
  for (const literal of values) {
    if (typeof literal === "string" && literal.length > MAX_LITERAL_LENGTH) {
      throw new SchemaRejected("enum_too_large");
    }
  }
};

const normalizeSchemaMap = (
  value: SchemaNode,
  ctx: Context,
  refStack: readonly string[]
): SchemaNode =>
  Object.fromEntries(
    Object.entries(value).map(([name, sub]) => {
      if (name.length > MAX_PROPERTY_NAME_LENGTH) {
        throw new SchemaRejected("property_name_too_long");
      }
      return [name, normalizeNode(sub, ctx, refStack)];
    })
  );

function normalizeNode(
  input: unknown,
  ctx: Context,
  refStack: readonly string[]
): unknown {
  // Boolean schemas and anything non-object pass through untouched.
  if (!isRecord(input)) {
    return input;
  }

  let node: SchemaNode = { ...input };

  if (typeof node.$ref === "string") {
    const ref = node.$ref;
    if (refStack.includes(ref)) {
      throw new SchemaRejected("ref_cycle");
    }
    if (refStack.length >= MAX_REF_DEPTH) {
      throw new SchemaRejected("ref_depth_exceeded");
    }
    if (!ctx.defs.has(ref)) {
      throw new SchemaRejected("unresolved_ref");
    }
    const { $ref: _ref, ...siblings } = node;
    const target = ctx.defs.get(ref);
    node = { ...(isRecord(target) ? target : {}), ...siblings };
    return normalizeNode(node, ctx, [...refStack, ref]);
  }

  const out: SchemaNode = {};
  for (const [key, value] of Object.entries(node)) {
    if (SCHEMA_MAP_KEYWORDS.has(key) && isRecord(value)) {
      out[key] = normalizeSchemaMap(value, ctx, refStack);
    } else if (SCHEMA_ARRAY_KEYWORDS.has(key) && Array.isArray(value)) {
      out[key] = value.map((sub) => normalizeNode(sub, ctx, refStack));
    } else if (SCHEMA_KEYWORDS.has(key)) {
      out[key] = Array.isArray(value)
        ? value.map((sub) => normalizeNode(sub, ctx, refStack))
        : normalizeNode(value, ctx, refStack);
    } else if (key === "description") {
      if (ctx.keepDescriptions && typeof value === "string") {
        out.description = capDescription(value);
      }
    } else if (LITERAL_KEYWORDS.has(key)) {
      assertLiteralSize(value);
      out[key] = value;
    } else if (COPIED_KEYWORDS.has(key)) {
      out[key] = value;
    }
    // Every other keyword is dropped on purpose.
  }

  return finalizeNode(out);
}

function finalizeNode(node: SchemaNode): SchemaNode {
  let result = node;

  // Flatten a single-branch anyOf/oneOf into the parent.
  for (const key of ["anyOf", "oneOf"]) {
    const branches = result[key];
    if (Array.isArray(branches) && branches.length === 1) {
      const { [key]: _removed, ...rest } = result;
      const branch = isRecord(branches[0]) ? branches[0] : {};
      result = { ...branch, ...rest };
    }
  }

  // type: [x, "null"] -> type: x, nullable: true
  if (Array.isArray(result.type)) {
    const types = result.type.filter((t) => t !== "null");
    const hadNull = types.length !== result.type.length;
    if (types.length === 1) {
      result = {
        ...result,
        type: types[0],
        ...(hadNull && { nullable: true }),
      };
    } else if (types.length > 1 && hadNull) {
      result = { ...result, type: types, nullable: true };
    }
  }

  if (result.type === "object" && result.properties === undefined) {
    result = { ...result, properties: {} };
  }

  return result;
}

/**
 * Reduces an MCP tool input schema to the conservative subset providers accept:
 * local `$ref`s inlined (depth <= 5, cycles rejected), only structural keywords kept
 * (validation-only and free-text keywords dropped), server descriptions dropped or capped,
 * literal values bounded, nullable unions simplified and the root forced to `type: "object"`.
 */
export function normalizeInputSchema(
  schema: unknown,
  options: NormalizeOptions = {}
): NormalizeResult {
  if (!isRecord(schema)) {
    return { ok: false, reason: "schema_not_object" };
  }

  const ctx: Context = {
    defs: collectDefs(schema),
    keepDescriptions: options.descriptions === "keep",
  };

  try {
    const normalized = normalizeNode(schema, ctx, []);
    if (!isRecord(normalized)) {
      return { ok: false, reason: "schema_not_object" };
    }
    if (normalized.type !== undefined && normalized.type !== "object") {
      return { ok: false, reason: "root_not_object" };
    }
    const root: SchemaNode = {
      ...normalized,
      type: "object",
      properties: isRecord(normalized.properties) ? normalized.properties : {},
    };
    return { ok: true, schema: root as JSONSchema7 };
  } catch (error) {
    if (error instanceof SchemaRejected) {
      return { ok: false, reason: error.message };
    }
    throw error;
  }
}
