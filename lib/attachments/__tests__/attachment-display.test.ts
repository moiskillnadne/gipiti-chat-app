import type { FileUIPart } from "ai";
import { describe, expect, it } from "vitest";
import {
  formatFileSize,
  getAttachmentDisplayName,
  getAttachmentSize,
  getFileExtensionBadge,
  isImageMediaType,
  isPdfMediaType,
  type StoredFilePart,
} from "../attachment-display";

const filePart = (fields: Partial<StoredFilePart> = {}): FileUIPart => ({
  type: "file",
  mediaType: "application/pdf",
  url: "https://example.public.blob.vercel-storage.com/report-AbC.pdf",
  ...fields,
});

// Intl separates the number and unit (and digit groups) with a no-break space.
const normalizeSpaces = (value: string): string => value.replace(/[  ]/g, " ");

describe("getAttachmentDisplayName", () => {
  it("prefers the AI SDK filename over the legacy name", () => {
    const part = filePart({ filename: "Отчёт.pdf", name: "old.pdf" });

    expect(getAttachmentDisplayName(part)).toBe("Отчёт.pdf");
  });

  it("falls back to the legacy name for messages sent before filename existed", () => {
    expect(getAttachmentDisplayName(filePart({ name: "CHANGELOG.md" }))).toBe(
      "CHANGELOG.md"
    );
  });

  it("keeps names with several dots and spaces intact", () => {
    const part = filePart({ filename: "512 (1).v2.final.pdf" });

    expect(getAttachmentDisplayName(part)).toBe("512 (1).v2.final.pdf");
  });

  it("skips blank values and returns undefined when no name is stored", () => {
    expect(getAttachmentDisplayName(filePart({ filename: "  " }))).toBe(
      undefined
    );
    expect(
      getAttachmentDisplayName(filePart({ filename: " ", name: "a.pdf" }))
    ).toBe("a.pdf");
  });
});

describe("getAttachmentSize", () => {
  it("returns the recorded byte size", () => {
    expect(getAttachmentSize(filePart({ size: 2048 }))).toBe(2048);
  });

  it("ignores missing or malformed sizes", () => {
    expect(getAttachmentSize(filePart())).toBe(undefined);
    expect(getAttachmentSize(filePart({ size: -1 }))).toBe(undefined);
    expect(getAttachmentSize(filePart({ size: Number.NaN }))).toBe(undefined);
  });
});

describe("getFileExtensionBadge", () => {
  it("upper-cases the last extension", () => {
    expect(getFileExtensionBadge("report.final.pdf")).toBe("PDF");
    expect(getFileExtensionBadge("notes.docx")).toBe("DOCX");
  });

  it("returns undefined for dotfiles, missing or overly long extensions", () => {
    expect(getFileExtensionBadge(".env")).toBe(undefined);
    expect(getFileExtensionBadge("README")).toBe(undefined);
    expect(getFileExtensionBadge("archive.")).toBe(undefined);
    expect(getFileExtensionBadge("data.verylongext")).toBe(undefined);
    expect(getFileExtensionBadge(undefined)).toBe(undefined);
  });
});

describe("media type guards", () => {
  it("detects PDFs and images", () => {
    expect(isPdfMediaType("application/pdf")).toBe(true);
    expect(isPdfMediaType("text/plain")).toBe(false);
    expect(isImageMediaType("image/png")).toBe(true);
    expect(isImageMediaType("application/pdf")).toBe(false);
  });
});

describe("formatFileSize", () => {
  it("formats bytes, kilobytes and megabytes with Russian units", () => {
    expect(normalizeSpaces(formatFileSize(0))).toBe("0 Б");
    expect(normalizeSpaces(formatFileSize(1023))).toBe("1 023 Б");
    expect(normalizeSpaces(formatFileSize(1024))).toBe("1 кБ");
    expect(normalizeSpaces(formatFileSize(2.44 * 1024 * 1024))).toBe("2,4 МБ");
    expect(normalizeSpaces(formatFileSize(10 * 1024 * 1024))).toBe("10 МБ");
  });

  it("switches to megabytes when kilobytes would round up to 1024", () => {
    expect(normalizeSpaces(formatFileSize(1_048_100))).toBe("1 МБ");
  });
});
