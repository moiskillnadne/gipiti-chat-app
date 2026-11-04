import { describe, expect, it } from "vitest";

import { normalizeInputSchema } from "../json-schema";

describe("normalizeInputSchema", () => {
  it("inlines local $ref and removes $defs", () => {
    // Act
    const result = normalizeInputSchema({
      type: "object",
      properties: { user: { $ref: "#/$defs/User" } },
      $defs: {
        User: { type: "object", properties: { id: { type: "string" } } },
      },
    });

    // Assert
    expect(result).toEqual({
      ok: true,
      schema: {
        type: "object",
        properties: {
          user: { type: "object", properties: { id: { type: "string" } } },
        },
      },
    });
  });

  it("rejects a $ref cycle", () => {
    // Act
    const result = normalizeInputSchema({
      type: "object",
      properties: { node: { $ref: "#/$defs/Node" } },
      $defs: {
        Node: {
          type: "object",
          properties: { next: { $ref: "#/$defs/Node" } },
        },
      },
    });

    // Assert
    expect(result).toEqual({ ok: false, reason: "ref_cycle" });
  });

  it("rejects refs nested deeper than 5", () => {
    // Arrange
    const defs: Record<string, unknown> = {};
    for (let i = 0; i < 7; i++) {
      defs[`D${i}`] = { $ref: `#/$defs/D${i + 1}` };
    }
    defs.D7 = { type: "string" };

    // Act
    const result = normalizeInputSchema({
      type: "object",
      properties: { a: { $ref: "#/$defs/D0" } },
      $defs: defs,
    });

    // Assert
    expect(result).toEqual({ ok: false, reason: "ref_depth_exceeded" });
  });

  it("rejects an unresolved ref", () => {
    // Act
    const result = normalizeInputSchema({
      type: "object",
      properties: { a: { $ref: "https://example.com/x.json" } },
    });

    // Assert
    expect(result).toEqual({ ok: false, reason: "unresolved_ref" });
  });

  it("drops validation-only keywords but keeps property names that match them", () => {
    // Act
    const result = normalizeInputSchema({
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      properties: {
        format: {
          type: "string",
          format: "email",
          pattern: "^a",
          minLength: 1,
          maxLength: 9,
          default: "x",
          examples: ["y"],
        },
        n: { type: "number", minimum: 0, maximum: 5 },
      },
    });

    // Assert
    expect(result).toEqual({
      ok: true,
      schema: {
        type: "object",
        properties: { format: { type: "string" }, n: { type: "number" } },
      },
    });
  });

  it("turns type [x, null] into x with nullable", () => {
    // Act
    const result = normalizeInputSchema({
      type: "object",
      properties: { a: { type: ["string", "null"] } },
    });

    // Assert
    expect(result).toMatchObject({
      ok: true,
      schema: { properties: { a: { type: "string", nullable: true } } },
    });
  });

  it("defaults properties for nested objects", () => {
    // Act
    const result = normalizeInputSchema({
      type: "object",
      properties: { a: { type: "object" } },
    });

    // Assert
    expect(result).toMatchObject({
      ok: true,
      schema: { properties: { a: { type: "object", properties: {} } } },
    });
  });

  it("flattens single-branch anyOf and oneOf", () => {
    // Act
    const result = normalizeInputSchema({
      type: "object",
      properties: {
        a: { anyOf: [{ type: "string" }], description: "d" },
        b: { oneOf: [{ type: "number" }] },
      },
    });

    // Assert
    expect(result).toMatchObject({
      ok: true,
      schema: {
        properties: {
          a: { type: "string", description: "d" },
          b: { type: "number" },
        },
      },
    });
  });

  it("keeps multi-branch anyOf", () => {
    // Act
    const result = normalizeInputSchema({
      type: "object",
      properties: { a: { anyOf: [{ type: "string" }, { type: "number" }] } },
    });

    // Assert
    expect(result).toMatchObject({
      ok: true,
      schema: {
        properties: {
          a: { anyOf: [{ type: "string" }, { type: "number" }] },
        },
      },
    });
  });

  it("forces a root object type when missing", () => {
    // Act
    const result = normalizeInputSchema({});

    // Assert
    expect(result).toEqual({
      ok: true,
      schema: { type: "object", properties: {} },
    });
  });

  it("rejects an explicitly non-object root", () => {
    expect(normalizeInputSchema({ type: "string" })).toEqual({
      ok: false,
      reason: "root_not_object",
    });
  });

  it("rejects a non-object input", () => {
    expect(normalizeInputSchema(null)).toEqual({
      ok: false,
      reason: "schema_not_object",
    });
  });
});
