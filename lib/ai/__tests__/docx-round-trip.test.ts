import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/ai/remote-image-fetch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ai/remote-image-fetch")>()),
  fetchPublicImageBytes: vi.fn(),
}));

import {
  fetchPublicImageBytes,
  RemoteImageFetchError,
} from "@/lib/ai/remote-image-fetch";

import { extractDocxText } from "../docx-extract";
import { createDocxBuffer } from "../generate-docx-document";

const IMAGE_URL = "https://images.test/chart.png";
const ZIP_SIGNATURE = "PK";

const MARKDOWN = [
  "## Итоги квартала",
  "",
  "Выручка выросла на **12%** по сравнению с прошлым кварталом.",
  "",
  "- Первый пункт списка",
  "- Второй пункт списка",
  "",
  "| Месяц | Выручка |",
  "| --- | --- |",
  "| Январь | 100 |",
  "| Февраль | 120 |",
  "",
  `![График выручки](${IMAGE_URL})`,
].join("\n");

/**
 * Builds a .docx with the app's own generator and reads it back with the
 * app's own extractor: `docx` writes the file, `sharp` prepares the embedded
 * image, `mammoth` parses the result.
 */
describe("generated .docx read back by the extractor", () => {
  beforeEach(async () => {
    const chart = await sharp({
      create: {
        width: 400,
        height: 240,
        channels: 3,
        background: { r: 30, g: 120, b: 90 },
      },
    })
      .png()
      .toBuffer();

    vi.mocked(fetchPublicImageBytes).mockImplementation(
      (url: string): Promise<Uint8Array> =>
        url === IMAGE_URL
          ? Promise.resolve(new Uint8Array(chart))
          : Promise.reject(
              new RemoteImageFetchError(
                "http_error",
                "Image download failed with status 404"
              )
            )
    );
  });

  afterEach(() => {
    vi.mocked(fetchPublicImageBytes).mockReset();
  });

  it("keeps the heading, text, list, table and image of the source document", async () => {
    // Act
    const docxBuffer = await createDocxBuffer({
      title: "Отчёт",
      markdown: MARKDOWN,
    });
    const extractedHtml = await extractDocxText(docxBuffer);

    // Assert
    expect(docxBuffer.subarray(0, 2).toString("latin1")).toBe(ZIP_SIGNATURE);
    expect(extractedHtml).toContain("Итоги квартала");
    expect(extractedHtml).toContain("<strong>12%</strong>");
    expect(extractedHtml).toContain("Первый пункт списка");
    expect(extractedHtml).toContain("Второй пункт списка");
    expect(extractedHtml).toContain("<table>");
    expect(extractedHtml).toContain("Февраль");
    expect(extractedHtml).toContain("[изображение]");
  });
});
