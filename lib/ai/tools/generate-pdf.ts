import { tool } from "ai";
import z from "zod/v4";
import { saveDocument } from "../../db/query/document/save-document";
import { generateUUID } from "../../utils";
import { createPdfBuffer } from "../generate-pdf-document";
import { uploadGeneratedPdf } from "../media-upload";

type GeneratePdfProps = {
  userId: string;
  chatId: string;
};

export const generatePdfTool = ({ userId }: GeneratePdfProps) =>
  tool({
    description: `Generate a downloadable PDF document from Markdown, OR produce an updated version of a PDF already in the conversation.

Use this tool when:
- The user explicitly asks to create, make, generate, export, or download a PDF (e.g. "сделай PDF", "create a PDF report", "export this as a PDF").
- The user wants written content delivered as a file they can download.
- The user asks to modify, update, extend, or rewrite a PDF that is already in the conversation — one they uploaded or one you generated earlier — and wants the updated file back.

Do NOT use this tool when:
- The user just wants an answer in chat and did not ask for a file.
- The user wants to read or analyze an attached PDF without producing a new file — answer directly instead.

How to author the document:
- Pass the full document body in "content" as GitHub-Flavored Markdown. Supported: headings (#, ##, ###), bold, italics, ~~strikethrough~~, inline \`code\`, links, ordered and unordered lists (including nesting), GFM tables (| col | col |), fenced code blocks, blockquotes, horizontal rules (---), and images.
- To embed an image, use Markdown image syntax with a publicly reachable URL: \`![alt text](https://...)\`. To include an image that already exists in this conversation (e.g. one you generated earlier with the image tool, or that the user shared as a URL), use that exact image URL. Place each image on its own line. Unreachable image URLs are skipped (their alt text is shown instead), so always provide meaningful alt text.
- Write in the same language as the user. Cyrillic and other non-Latin text render correctly.
- Pass a short, human-readable document name in "title" (used as the file name and PDF metadata). If you want a visible title on the first page, also include a top-level "# Heading" in "content".

Updating an existing PDF:
- Reproduce the ENTIRE document in "content" with ONLY the requested changes applied. Keep everything the user did not ask to change exactly as it was — structure, wording, and formatting. Never return just the changed fragment; always emit the complete updated document.`,
    inputSchema: z.object({
      title: z
        .string()
        .describe(
          "Short, human-readable document name (used as the file name)."
        ),
      content: z
        .string()
        .describe(
          "The full document body as GitHub-Flavored Markdown. When updating an existing PDF, include the entire document, not just the changes."
        ),
    }),
    execute: async ({ title, content }) => {
      const id = generateUUID();
      try {
        const buffer = await createPdfBuffer({ title, markdown: content });
        const pdfUrl = await uploadGeneratedPdf(buffer);

        await saveDocument({
          id,
          title,
          content: pdfUrl,
          kind: "pdf",
          userId,
        });

        return {
          id,
          pdfUrl,
          title,
          content: "PDF was generated and uploaded successfully.",
        };
      } catch (error) {
        console.error("Failed to generate PDF", error);
        return {
          id,
          pdfUrl: undefined as string | undefined,
          title,
          content: "Failed to generate the PDF document.",
        };
      }
    },
  });

export const generatePdf = generatePdfTool;
