import type { JSONSchema7 } from "@ai-sdk/provider";

const MAX_REF_DEPTH = 5;

const DROPPED_KEYWORDS = new Set([
  "$schema",
  "format",
  "pattern",
  "minimum",
  "maximum",
  "minLength",
  "maxLength",
  "examples",
  "default",
]);

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

class SchemaRejected extends Error {}

const isRecord = (value: unknown): value is SchemaNode =>
  typeof value === "object" && value !== null && !Array.isArray(value);

type Context = { defs: Map<string, unknown> };

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
    if (DROPPED_KEYWORDS.has(key) || key === "$defs" || key === "definitions") {
      continue;
    }
    if (SCHEMA_MAP_KEYWORDS.has(key) && isRecord(value)) {
      out[key] = Object.fromEntries(
        Object.entries(value).map(([name, sub]) => [
          name,
          normalizeNode(sub, ctx, refStack),
        ])
      );
    } else if (SCHEMA_ARRAY_KEYWORDS.has(key) && Array.isArray(value)) {
      out[key] = value.map((sub) => normalizeNode(sub, ctx, refStack));
    } else if (SCHEMA_KEYWORDS.has(key)) {
      out[key] = Array.isArray(value)
        ? value.map((sub) => normalizeNode(sub, ctx, refStack))
        : normalizeNode(value, ctx, refStack);
    } else {
      out[key] = value;
    }
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
 * local `$ref`s inlined (depth <= 5, cycles rejected), validation-only keywords
 * dropped, nullable unions simplified and the root forced to `type: "object"`.
 */
export function normalizeInputSchema(schema: unknown): NormalizeResult {
  if (!isRecord(schema)) {
    return { ok: false, reason: "schema_not_object" };
  }

  try {
    const normalized = normalizeNode(schema, { defs: collectDefs(schema) }, []);
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
