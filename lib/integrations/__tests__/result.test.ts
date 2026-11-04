import type { CallToolResult } from "@ai-sdk/mcp";
import { describe, expect, it } from "vitest";

import {
  MAX_ERROR_MESSAGE_CHARS,
  MAX_OUTPUT_CHARS,
  toModelOutput,
} from "../result";

const result = (value: unknown) => value as CallToolResult;

describe("toModelOutput", () => {
  it("joins text content with newlines", () => {
    // Arrange
    const input = result({
      content: [
        { type: "text", text: "first" },
        { type: "text", text: "second" },
      ],
    });

    // Act
    const output = toModelOutput(input);

    // Assert
    expect(output).toBe("first\nsecond");
  });

  it("replaces image, audio and resource content with a mime placeholder", () => {
    // Arrange
    const input = result({
      content: [
        { type: "text", text: "caption" },
        { type: "image", data: "AAAA", mimeType: "image/png" },
        { type: "audio", data: "AAAA", mimeType: "audio/wav" },
        {
          type: "resource",
          resource: {
            uri: "file:///a",
            mimeType: "application/pdf",
            blob: "AA",
          },
        },
        { type: "resource", resource: { uri: "file:///b", text: "secret" } },
      ],
    });

    // Act
    const output = toModelOutput(input);

    // Assert
    expect(output).toBe(
      [
        "caption",
        "[non-text content omitted: image/png]",
        "[non-text content omitted: audio/wav]",
        "[non-text content omitted: application/pdf]",
        "[non-text content omitted: unknown]",
      ].join("\n")
    );
  });

  it("truncates long output to the limit and appends a marker", () => {
    // Arrange
    const input = result({
      content: [{ type: "text", text: "a".repeat(MAX_OUTPUT_CHARS + 500) }],
    });

    // Act
    const output = toModelOutput(input);

    // Assert
    expect(typeof output).toBe("string");
    const text = output as string;
    expect(text.startsWith("a".repeat(MAX_OUTPUT_CHARS))).toBe(true);
    expect(text.length).toBeGreaterThan(MAX_OUTPUT_CHARS);
    expect(text).toContain("truncated");
    expect(text.slice(MAX_OUTPUT_CHARS).trim()).toContain("[output truncated");
  });

  it("does not add a marker at exactly the limit", () => {
    // Arrange
    const input = result({
      content: [{ type: "text", text: "a".repeat(MAX_OUTPUT_CHARS) }],
    });

    // Act
    const output = toModelOutput(input);

    // Assert
    expect(output).toBe("a".repeat(MAX_OUTPUT_CHARS));
  });

  it("maps isError to a tool_error with a bounded message", () => {
    // Arrange
    const input = result({
      isError: true,
      content: [
        { type: "text", text: "x".repeat(MAX_ERROR_MESSAGE_CHARS * 2) },
      ],
    });

    // Act
    const output = toModelOutput(input);

    // Assert
    expect(output).toEqual({
      ok: false,
      error: "tool_error",
      message: "x".repeat(MAX_ERROR_MESSAGE_CHARS),
    });
  });

  it("gives an error without text a generic message", () => {
    // Arrange
    const input = result({ isError: true, content: [] });

    // Act
    const output = toModelOutput(input);

    // Assert
    expect(output).toMatchObject({ ok: false, error: "tool_error" });
    expect((output as { message: string }).message.length).toBeGreaterThan(0);
  });

  it("returns an empty string for a legacy toolResult payload", () => {
    // Arrange
    const input = result({ toolResult: { anything: true } });

    // Act
    const output = toModelOutput(input);

    // Assert
    expect(output).toBe("");
  });
});
