import "server-only";

import type { StyleDictionary, TDocumentDefinitions } from "pdfmake/interfaces";
import {
  collectImageUrls,
  markdownToPdfmakeContent,
} from "./markdown-to-pdfmake";
import { getConfiguredPdfmake } from "./pdf-fonts";
import { resolvePdfImages } from "./pdf-images";

const PAGE_MARGINS: [number, number, number, number] = [40, 48, 40, 56];

const DEFAULT_STYLE = {
  font: "Roboto",
  fontSize: 11,
  lineHeight: 1.35,
  color: "#1f2933",
};

const STYLES: StyleDictionary = {
  h1: { fontSize: 22, bold: true, margin: [0, 0, 0, 10] },
  h2: { fontSize: 18, bold: true, margin: [0, 12, 0, 6] },
  h3: { fontSize: 15, bold: true, margin: [0, 10, 0, 5] },
  h4: { fontSize: 13, bold: true, margin: [0, 8, 0, 4] },
  tableHeader: { bold: true, fillColor: "#f3f4f6" },
  code: { fontSize: 10, color: "#111827" },
};

type CreatePdfBufferInput = {
  title: string;
  markdown: string;
};

/**
 * Render a Markdown document to a PDF Buffer using pdfmake with the embedded
 * Cyrillic-capable Roboto font. The `title` is embedded as PDF metadata; the
 * visible document is driven entirely by `markdown`.
 */
export async function createPdfBuffer({
  title,
  markdown,
}: CreatePdfBufferInput): Promise<Buffer> {
  const pdfmake = getConfiguredPdfmake();

  // Fetch + embed any referenced images before rendering (sync conversion).
  const imageMap = await resolvePdfImages(collectImageUrls(markdown));

  const documentDefinition: TDocumentDefinitions = {
    info: { title },
    pageSize: "A4",
    pageMargins: PAGE_MARGINS,
    defaultStyle: DEFAULT_STYLE,
    styles: STYLES,
    content: markdownToPdfmakeContent(markdown, imageMap),
  };

  return await pdfmake.createPdf(documentDefinition).getBuffer();
}
