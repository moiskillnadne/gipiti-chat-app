import "server-only";

import { Document, Packer, Paragraph, TextRun } from "docx";
import { resolveDocxImages } from "./docx-images";
import { markdownToDocx } from "./markdown-to-docx";
import { collectImageUrls } from "./markdown-to-pdfmake";

/** Default body font. Calibri ships with Word and fully covers Cyrillic. */
const DEFAULT_FONT = "Calibri";
/** 11pt expressed in half-points (docx run size unit). */
const DEFAULT_FONT_SIZE = 22;

type CreateDocxBufferInput = {
  title: string;
  markdown: string;
};

/**
 * Render a Markdown document to a .docx Buffer using the `docx` library. Unlike
 * the PDF path no fonts are bundled: docx stores Unicode text and Word renders
 * it with its own fonts, so Cyrillic works out of the box. The `title` is
 * embedded as document metadata; the visible document is driven by `markdown`.
 */
export async function createDocxBuffer({
  title,
  markdown,
}: CreateDocxBufferInput): Promise<Buffer> {
  // Fetch + decode any referenced images before rendering.
  const imageMap = await resolveDocxImages(collectImageUrls(markdown));
  const { children, numbering } = markdownToDocx(markdown, imageMap);

  const doc = new Document({
    title,
    ...(numbering.length > 0 ? { numbering: { config: numbering } } : {}),
    styles: {
      default: {
        document: {
          run: { font: DEFAULT_FONT, size: DEFAULT_FONT_SIZE },
        },
      },
    },
    sections: [
      {
        children:
          children.length > 0
            ? children
            : [new Paragraph({ children: [new TextRun(markdown)] })],
      },
    ],
  });

  return await Packer.toBuffer(doc);
}
