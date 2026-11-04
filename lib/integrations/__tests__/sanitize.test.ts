import { describe, expect, it } from "vitest";

import { hashDefinitions, sanitizeDefinition } from "../sanitize";

const SHA256_HEX = /^[0-9a-f]{64}$/;
const schema = { type: "object" as const, properties: {} };

describe("sanitizeDefinition", () => {
  it("strips a tag-block payload hidden in the description", () => {
    // Arrange
    const hidden = String.fromCodePoint(0xe_00_49, 0xe_00_67, 0xe_00_6e);

    // Act
    const result = sanitizeDefinition({
      name: "read",
      description: `Reads a file${hidden}`,
      inputSchema: schema,
    });

    // Assert
    expect(result).toMatchObject({
      ok: true,
      definition: { description: "Reads a file" },
    });
  });

  it("strips bidi, zero-width and control characters but keeps newline and tab", () => {
    // Arrange
    const description = "a‮b​c\u0007d\u0085e\nf\tg\rh";

    // Act
    const result = sanitizeDefinition({
      name: "t",
      description,
      inputSchema: schema,
    });

    // Assert
    expect(result).toMatchObject({
      ok: true,
      definition: { description: "abcde\nf\tgh" },
    });
  });

  it("strips invisible characters inside schema strings and keys", () => {
    // Act
    const result = sanitizeDefinition({
      name: "t",
      description: "",
      inputSchema: {
        type: "object",
        properties: { "q​": { type: "string", description: "x‮y" } },
      },
    });

    // Assert
    expect(result).toMatchObject({
      ok: true,
      definition: {
        inputSchema: {
          properties: { q: { type: "string", description: "xy" } },
        },
      },
    });
  });

  it("keeps Cyrillic text", () => {
    // Act
    const result = sanitizeDefinition({
      name: "t",
      description: "Поиск файлов",
      inputSchema: schema,
    });

    // Assert
    expect(result).toMatchObject({
      ok: true,
      definition: { description: "Поиск файлов" },
    });
  });

  it("caps descriptions at 1000 characters", () => {
    // Act
    const result = sanitizeDefinition({
      name: "t",
      description: "я".repeat(1500),
      inputSchema: schema,
    });

    // Assert
    expect(result.ok && result.definition.description).toHaveLength(1000);
  });

  it("rejects a schema over 4 KB with a reason", () => {
    // Act
    const result = sanitizeDefinition({
      name: "t",
      description: "",
      inputSchema: { type: "object", description: "x".repeat(5000) },
    });

    // Assert
    expect(result).toEqual({ ok: false, reason: "schema_too_large" });
  });

  it("rejects a name that is empty after stripping", () => {
    // Act
    const result = sanitizeDefinition({
      name: "​",
      description: "",
      inputSchema: schema,
    });

    // Assert
    expect(result).toEqual({ ok: false, reason: "empty_name" });
  });
});

describe("hashDefinitions", () => {
  const a = { name: "a", description: "da", inputSchema: schema };
  const b = {
    name: "b",
    description: "db",
    inputSchema: { type: "object" as const, required: ["x"] },
  };

  it("ignores entry order and key order", () => {
    // Arrange
    const reordered = {
      inputSchema: { required: ["x"], type: "object" as const },
      description: "db",
      name: "b",
    };

    // Act + Assert
    expect(hashDefinitions([a, b])).toBe(hashDefinitions([reordered, a]));
  });

  it("changes when a description changes", () => {
    expect(hashDefinitions([a, b])).not.toBe(
      hashDefinitions([{ ...a, description: "changed" }, b])
    );
  });

  it("returns a sha256 hex digest", () => {
    expect(hashDefinitions([])).toMatch(SHA256_HEX);
  });
});
