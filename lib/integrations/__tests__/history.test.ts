import { describe, expect, it } from "vitest";

import {
  compactMcpHistory,
  flattenOrphans,
  HISTORY_OUTPUT_CHARS,
  hasMcpParts,
} from "../history";

type Part = { type: string; [key: string]: unknown };
type Msg = { id: string; role: string; parts: Part[] };

const TOOL = "mcp_deepwiki__ask_wiki_question";
const mcpPart = (output: unknown, type = `tool-${TOOL}`): Part => ({
  type,
  toolCallId: "c1",
  state: "output-available",
  input: {},
  output,
});
const user = (id: string): Msg => ({
  id,
  role: "user",
  parts: [{ type: "text", text: id }],
});
const assistant = (id: string, parts: Part[]): Msg => ({
  id,
  role: "assistant",
  parts,
});
const active = new Set([TOOL]);

describe("hasMcpParts", () => {
  it("detects MCP parts and ignores other tool parts", () => {
    // Arrange
    const withMcp = [assistant("a", [mcpPart("x")])];
    const without = [assistant("a", [{ type: "tool-generateImage" }])];

    // Act / Assert
    expect(hasMcpParts(withMcp)).toBe(true);
    expect(hasMcpParts(without)).toBe(false);
  });
});

describe("flattenOrphans", () => {
  it("returns the same reference when there are no MCP parts", () => {
    // Arrange
    const messages = [
      user("u1"),
      assistant("a1", [{ type: "text", text: "hi" }]),
    ];

    // Act
    const result = flattenOrphans(messages, {
      activeToolNames: active,
      modelSupportsMcp: true,
    });

    // Assert
    expect(result).toBe(messages);
  });

  it("keeps active tool parts when the model supports MCP", () => {
    // Arrange
    const messages = [assistant("a1", [mcpPart("answer")])];

    // Act
    const result = flattenOrphans(messages, {
      activeToolNames: active,
      modelSupportsMcp: true,
    });

    // Assert
    expect(result[0]).toBe(messages[0]);
  });

  it("flattens a part whose tool is not active into text", () => {
    // Arrange
    const messages = [assistant("a1", [mcpPart("answer")])];

    // Act
    const result = flattenOrphans(messages, {
      activeToolNames: new Set(),
      modelSupportsMcp: true,
      integrationLabel: () => "DeepWiki",
    });

    // Assert
    expect(result[0].parts).toEqual([
      { type: "text", text: "[DeepWiki · ask_wiki_question: answer]" },
    ]);
  });

  it("flattens every MCP part when the model has no MCP", () => {
    // Arrange
    const messages = [assistant("a1", [mcpPart("answer")])];

    // Act
    const result = flattenOrphans(messages, {
      activeToolNames: active,
      modelSupportsMcp: false,
    });

    // Assert
    expect(result[0].parts[0]).toMatchObject({ type: "text" });
  });

  it("clips output to 600 chars and falls back to 'no result'", () => {
    // Arrange
    const messages = [
      assistant("a1", [
        mcpPart("x".repeat(2000)),
        mcpPart(undefined, "tool-mcp_deepwiki__other"),
      ]),
    ];

    // Act
    const result = flattenOrphans(messages, {
      activeToolNames: new Set(),
      modelSupportsMcp: true,
    });

    // Assert
    expect(result[0].parts[0].text).toBe(
      `[deepwiki · ask_wiki_question: ${"x".repeat(HISTORY_OUTPUT_CHARS)}]`
    );
    expect(result[0].parts[1].text).toBe("[deepwiki · other: no result]");
  });

  it("does not mutate its input", () => {
    // Arrange
    const messages = [assistant("a1", [mcpPart("answer")])];
    const snapshot = structuredClone(messages);

    // Act
    flattenOrphans(messages, {
      activeToolNames: new Set(),
      modelSupportsMcp: false,
    });

    // Assert
    expect(messages).toEqual(snapshot);
  });
});

describe("compactMcpHistory", () => {
  const long = "y".repeat(HISTORY_OUTPUT_CHARS + 100);

  it("returns the same reference when there are no MCP parts", () => {
    // Arrange
    const messages = [user("u1")];

    // Act / Assert
    expect(compactMcpHistory(messages)).toBe(messages);
  });

  it("truncates outputs before the last two user turns only", () => {
    // Arrange
    const messages = [
      user("u1"),
      assistant("a1", [mcpPart(long)]),
      user("u2"),
      assistant("a2", [mcpPart(long)]),
      user("u3"),
      assistant("a3", [mcpPart(long)]),
    ];

    // Act
    const result = compactMcpHistory(messages);

    // Assert
    const old = result[1].parts[0].output as string;
    expect(old.startsWith("y".repeat(HISTORY_OUTPUT_CHARS))).toBe(true);
    expect(old).toContain("[output truncated]");
    expect(old.length).toBeLessThan(long.length);
    expect(result[3]).toBe(messages[3]);
    expect(result[5]).toBe(messages[5]);
  });

  it("leaves everything alone with fewer than two user turns", () => {
    // Arrange
    const messages = [user("u1"), assistant("a1", [mcpPart(long)])];

    // Act
    const result = compactMcpHistory(messages);

    // Assert
    expect(result[1]).toBe(messages[1]);
  });

  it("does not mutate its input", () => {
    // Arrange
    const messages = [
      user("u1"),
      assistant("a1", [mcpPart(long)]),
      user("u2"),
      user("u3"),
    ];
    const snapshot = structuredClone(messages);

    // Act
    compactMcpHistory(messages);

    // Assert
    expect(messages).toEqual(snapshot);
  });
});
