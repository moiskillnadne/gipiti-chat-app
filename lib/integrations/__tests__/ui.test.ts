import { describe, expect, it } from "vitest";
import { isMcpToolPart } from "@/lib/types";
import {
  MAX_SELECTED_INTEGRATIONS,
  parseMcpPartName,
  parseStoredSelection,
  readMcpFailure,
  selectionStorageKey,
} from "../ui";

describe("parseMcpPartName", () => {
  it("splits a built-in part type into slug and tool", () => {
    const result = parseMcpPartName("tool-mcp_deepwiki__ask_wiki_question");

    expect(result).toEqual({
      integration: "deepwiki",
      tool: "ask_wiki_question",
    });
  });

  it("maps a custom slug to custom", () => {
    const result = parseMcpPartName("tool-mcp_c1a2b3c__search");

    expect(result?.integration).toBe("custom");
  });

  it("returns null for non-MCP and malformed types", () => {
    expect(parseMcpPartName("tool-webSearch")).toBeNull();
    expect(parseMcpPartName("tool-mcp_nodelimiter")).toBeNull();
  });
});

describe("isMcpToolPart", () => {
  it("matches only tool-mcp_ parts", () => {
    expect(isMcpToolPart({ type: "tool-mcp_x__y" })).toBe(true);
    expect(isMcpToolPart({ type: "tool-calculator" })).toBe(false);
  });
});

describe("readMcpFailure", () => {
  it("reads an error code", () => {
    expect(readMcpFailure({ ok: false, error: "timeout" })).toEqual({
      code: "timeout",
      message: undefined,
    });
  });

  it("returns null for text output and non-objects", () => {
    expect(readMcpFailure("some text")).toBeNull();
    expect(readMcpFailure(undefined)).toBeNull();
  });
});

describe("parseStoredSelection", () => {
  it("returns [] for null, bad JSON and non-arrays", () => {
    expect(parseStoredSelection(null)).toEqual([]);
    expect(parseStoredSelection("{")).toEqual([]);
    expect(parseStoredSelection('{"a":1}')).toEqual([]);
  });

  it("keeps strings only and caps the length", () => {
    const raw = JSON.stringify(["a", 1, "b", "c", "d", "e", "f"]);

    const result = parseStoredSelection(raw);

    expect(result).toEqual(["a", "b", "c", "d", "e"]);
    expect(result.length).toBeLessThanOrEqual(MAX_SELECTED_INTEGRATIONS);
  });

  it("keys the selection per chat", () => {
    expect(selectionStorageKey("abc")).toBe("integrations:abc");
  });
});
