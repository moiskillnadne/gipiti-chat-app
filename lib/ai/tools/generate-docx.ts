import { tool } from "ai";
import z from "zod/v4";
import { saveDocument } from "../../db/query/document/save-document";
import { generateUUID } from "../../utils";
import { createDocxBuffer } from "../generate-docx-document";
import { uploadGeneratedDocx } from "../media-upload";

type GenerateDocxProps = {
  userId: string;
  chatId: string;
};

export const generateDocxTool = ({ userId }: GenerateDocxProps) =>
  tool({
    description: `Generate a downloadable Word (.docx) document from Markdown, OR produce an updated version of a .docx already in the conversation.

Use this tool when:
- The user explicitly asks to create, make, generate, export, or download a Word document (e.g. "сделай Word", "сделай docx", "create a Word document", "экспортируй в .docx").
- The user wants written content delivered as an editable Word file.
- The user asks to modify, update, extend, or rewrite a .docx that is already in the conversation — one they uploaded or one you generated earlier — and wants the updated file back.

Prefer generatePdf instead when the user asks specifically for a PDF. Do NOT use this tool when:
- The user just wants an answer in chat and did not ask for a file.
- The user wants to read or analyze an attached document without producing a new file — answer directly instead.

How to author the document:
- Pass the full document body in "content" as GitHub-Flavored Markdown. Supported: headings (#, ##, ###), bold, italics, ~~strikethrough~~, inline \`code\`, links, ordered and unordered lists (including nesting), GFM tables (| col | col |), fenced code blocks, blockquotes, horizontal rules (---), and images.
- To embed an image, use Markdown image syntax with a publicly reachable URL: \`![alt text](https://...)\`. To include an image already in this conversation, use that exact image URL. Unreachable image URLs are skipped (their alt text is shown instead), so always provide meaningful alt text.
- Write in the same language as the user. Cyrillic and other non-Latin text render correctly.
- Pass a short, human-readable document name in "title" (used as the file name and document metadata). If you want a visible title on the first page, also include a top-level "# Heading" in "content".

Updating an existing document:
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
          "The full document body as GitHub-Flavored Markdown. When updating an existing document, include the entire document, not just the changes."
        ),
    }),
    execute: async ({ title, content }) => {
      const id = generateUUID();
      try {
        const buffer = await createDocxBuffer({ title, markdown: content });
        const docxUrl = await uploadGeneratedDocx(buffer);

        await saveDocument({
          id,
          title,
          content: docxUrl,
          kind: "docx",
          userId,
        });

        return {
          id,
          docxUrl,
          title,
          content: "DOCX was generated and uploaded successfully.",
        };
      } catch (error) {
        console.error("Failed to generate DOCX", error);
        return {
          id,
          docxUrl: undefined as string | undefined,
          title,
          content: "Failed to generate the DOCX document.",
        };
      }
    },
  });

export const generateDocx = generateDocxTool;
