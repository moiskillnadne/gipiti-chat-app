import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChatMessage } from "@/lib/types";
import { attachDocxContentForModel, DOCX_MIME_TYPE } from "../docx-extract";

vi.mock("server-only", () => ({}));

const docxMessage = (url: string): ChatMessage => ({
  id: "m1",
  role: "user",
  parts: [
    { type: "file", mediaType: DOCX_MIME_TYPE, filename: "report.docx", url },
    { type: "text", text: "Summarize" },
  ],
});

describe("attachDocxContentForModel", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("never fetches a URL outside the Blob store and degrades to an error note", async () => {
    // Arrange
    const fetchSpy = vi.fn(
      async () => new Response("internal secret", { status: 200 })
    );
    vi.stubGlobal("fetch", fetchSpy);
    vi.spyOn(console, "error").mockReturnValue(undefined);

    // Act
    const [result] = await attachDocxContentForModel([
      docxMessage("http://10.0.0.5/internal/report.docx"),
    ]);

    // Assert
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.parts[0]).toEqual({
      type: "text",
      text: '[Не удалось прочитать файл "report.docx".]',
    });
    expect(result.parts[1]).toEqual({ type: "text", text: "Summarize" });
  });

  it("downloads a Blob-hosted document through the fetch policy", async () => {
    // Arrange: not a real .docx, so extraction fails after the download.
    const fetchSpy = vi.fn(
      async () => new Response("not a docx", { status: 200 })
    );
    vi.stubGlobal("fetch", fetchSpy);
    vi.spyOn(console, "error").mockReturnValue(undefined);
    const blobUrl = "https://store.public.blob.vercel-storage.com/report.docx";

    // Act
    await attachDocxContentForModel([docxMessage(blobUrl)]);

    // Assert
    expect(fetchSpy).toHaveBeenCalledWith(
      blobUrl,
      expect.objectContaining({ redirect: "error" })
    );
  });
});
