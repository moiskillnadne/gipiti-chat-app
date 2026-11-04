import { describe, expect, it } from "vitest";

import {
  isMcpToolName,
  parseMcpPartType,
  toModelToolName,
} from "../tool-names";

const none = new Set<string>();
const SAFE_NAME = /^[a-zA-Z0-9_]+$/;
const HASH_SUFFIX = /_[0-9a-f]{6}$/;
const COLLISION_NAME = /^mcp_x__a_b_[0-9a-f]{6}$/;

describe("toModelToolName", () => {
  it("prefixes slug and name", () => {
    // Act
    const name = toModelToolName({
      slug: "github",
      originalName: "create_issue",
      taken: none,
    });

    // Assert
    expect(name).toBe("mcp_github__create_issue");
  });

  it("replaces characters outside [a-zA-Z0-9_], including Cyrillic", () => {
    // Act
    const name = toModelToolName({
      slug: "c1a2b3c",
      originalName: "найти-файл.v2",
      taken: none,
    });

    // Assert
    expect(name).toBe("mcp_c1a2b3c__найти_файл_v2".replace(/[^\w]/g, "_"));
    expect(name).toMatch(SAFE_NAME);
  });

  it("caps a 70-character name at 64 characters with a hash suffix", () => {
    // Arrange
    const originalName = "a".repeat(70);

    // Act
    const name = toModelToolName({ slug: "x", originalName, taken: none });

    // Assert
    expect(name).toHaveLength(64);
    expect(name).toMatch(HASH_SUFFIX);
  });

  it("keeps different long names distinct", () => {
    // Arrange
    const a = `${"a".repeat(70)}1`;
    const b = `${"a".repeat(70)}2`;

    // Act
    const nameA = toModelToolName({ slug: "x", originalName: a, taken: none });
    const nameB = toModelToolName({ slug: "x", originalName: b, taken: none });

    // Assert
    expect(nameA).not.toBe(nameB);
  });

  it("adds a hash suffix on collision with a taken name", () => {
    // Arrange
    const taken = new Set(["mcp_x__a_b"]);

    // Act
    const name = toModelToolName({ slug: "x", originalName: "a.b", taken });

    // Assert
    expect(name).toMatch(COLLISION_NAME);
    expect(taken.has(name)).toBe(false);
  });

  it("is deterministic", () => {
    // Arrange
    const input = { slug: "x", originalName: "a".repeat(80), taken: none };

    // Act + Assert
    expect(toModelToolName(input)).toBe(toModelToolName(input));
  });
});

describe("isMcpToolName / parseMcpPartType", () => {
  it("recognises MCP tool names", () => {
    expect(isMcpToolName("mcp_github__create_issue")).toBe(true);
    expect(isMcpToolName("generateImage")).toBe(false);
  });

  it("extracts the tool name from an MCP UI part type", () => {
    expect(parseMcpPartType("tool-mcp_github__create_issue")).toBe(
      "mcp_github__create_issue"
    );
  });

  it("returns null for other part types", () => {
    expect(parseMcpPartType("tool-generateImage")).toBeNull();
    expect(parseMcpPartType("text")).toBeNull();
  });
});
