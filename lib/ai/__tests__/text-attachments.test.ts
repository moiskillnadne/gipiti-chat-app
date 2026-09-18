import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChatMessage } from "@/lib/types";
import {
  attachTextContentForModel,
  formatTextAttachmentForModel,
  MARKDOWN_MIME_TYPE,
  PLAIN_TEXT_MIME_TYPE,
  resolveTextAttachmentMediaType,
} from "../text-attachments";

vi.mock("server-only", () => ({}));

const userMessage = (parts: ChatMessage["parts"]): ChatMessage => ({
  id: "m1",
  role: "user",
  parts,
});

const filePart = (
  mediaType: string,
  filename: string,
  url = "https://blob.example/file"
): ChatMessage["parts"][number] => ({
  type: "file",
  mediaType,
  url,
  filename,
});

describe("resolveTextAttachmentMediaType", () => {
  it("maps .md and .markdown to text/markdown regardless of case", () => {
    expect(resolveTextAttachmentMediaType("README.md")).toBe(
      MARKDOWN_MIME_TYPE
    );
    expect(resolveTextAttachmentMediaType("notes.MARKDOWN")).toBe(
      MARKDOWN_MIME_TYPE
    );
  });

  it("maps .txt and code files to text/plain", () => {
    expect(resolveTextAttachmentMediaType("a.txt")).toBe(PLAIN_TEXT_MIME_TYPE);
    expect(resolveTextAttachmentMediaType("a.ts")).toBe(PLAIN_TEXT_MIME_TYPE);
    expect(resolveTextAttachmentMediaType("a.json")).toBe(PLAIN_TEXT_MIME_TYPE);
  });

  it("rejects unsupported extensions and extension-less names", () => {
    expect(resolveTextAttachmentMediaType("a.exe")).toBeUndefined();
    expect(resolveTextAttachmentMediaType("a.pdf")).toBeUndefined();
    expect(resolveTextAttachmentMediaType("Makefile")).toBeUndefined();
  });
});

describe("formatTextAttachmentForModel", () => {
  it("wraps the content in a labelled four-backtick fence", () => {
    const result = formatTextAttachmentForModel("a.md", "markdown", "# Hi");
    expect(result).toBe('Содержимое файла "a.md":\n\n````markdown\n# Hi\n````');
  });

  it("truncates oversized content with a marker", () => {
    const result = formatTextAttachmentForModel(
      "a.md",
      "markdown",
      "x".repeat(250_000)
    );
    expect(result).toContain("[файл обрезан");
    expect(result.length).toBeLessThan(201_000);
  });
});

describe("attachTextContentForModel", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("replaces markdown file parts with fetched text and keeps other parts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("# Title\n\nbody", { status: 200 }))
    );

    const [result] = await attachTextContentForModel([
      userMessage([
        filePart(MARKDOWN_MIME_TYPE, "spec.md"),
        filePart("application/pdf", "doc.pdf"),
        { type: "text", text: "Summarize" },
      ]),
    ]);

    expect(result.parts).toHaveLength(3);
    expect(result.parts[0]).toEqual({
      type: "text",
      text: 'Содержимое файла "spec.md":\n\n````markdown\n# Title\n\nbody\n````',
    });
    expect(result.parts[1]).toMatchObject({
      type: "file",
      mediaType: "application/pdf",
    });
    expect(result.parts[2]).toEqual({ type: "text", text: "Summarize" });
  });

  it("uses the extension as the fence language for plain-text code files", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("const a = 1;", { status: 200 }))
    );

    const [result] = await attachTextContentForModel([
      userMessage([filePart(PLAIN_TEXT_MIME_TYPE, "index.ts")]),
    ]);

    expect(result.parts[0]).toMatchObject({ type: "text" });
    expect((result.parts[0] as { text: string }).text).toContain("````ts\n");
  });

  it("returns the same message object when there is nothing to extract", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const message = userMessage([{ type: "text", text: "hello" }]);

    const [result] = await attachTextContentForModel([message]);

    expect(result).toBe(message);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("degrades to an error note when the blob cannot be fetched", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 404 }))
    );

    const [result] = await attachTextContentForModel([
      userMessage([filePart(MARKDOWN_MIME_TYPE, "gone.md")]),
    ]);

    expect(result.parts[0]).toEqual({
      type: "text",
      text: '[Не удалось прочитать файл "gone.md".]',
    });
  });
});
