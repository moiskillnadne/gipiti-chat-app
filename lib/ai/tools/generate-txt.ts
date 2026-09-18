import { tool } from "ai";
import z from "zod/v4";
import { saveDocument } from "../../db/query/document/save-document";
import { generateUUID } from "../../utils";
import { uploadGeneratedTxt } from "../media-upload";

type GenerateTxtProps = {
  userId: string;
  chatId: string;
};

export const generateTxtTool = ({ userId }: GenerateTxtProps) =>
  tool({
    description: `Generate a downloadable plain-text (.txt) file, OR produce an updated version of a .txt file already in the conversation.

Use this tool when:
- The user explicitly asks to create, make, generate, export, save, or download a text / .txt file (e.g. "сделай txt", "сохрани в текстовый файл", "экспортируй в .txt", "create a notes.txt").
- The user wants written content delivered as a plain-text file rather than as a chat reply — notes, a list, a transcript, a log, a script draft, configuration lines.
- The user asks to modify, update, extend, or rewrite a .txt file that is already in the conversation — one they uploaded or one you generated earlier — and wants the updated file back.

Prefer generateMarkdown when the user asks for Markdown / .md, generateCsv for tabular data (CSV, a table for Excel / Google Sheets), and generatePdf or generateDocx when they ask specifically for a PDF or Word document. Do NOT use this tool when:
- The user just wants an answer in chat and did not ask for a file.
- The user wants to read, summarize, or analyze an attached .txt file without producing a new file — answer directly instead.

How to author the file:
- Pass the complete file body in "content" as PLAIN TEXT. It is written to the file verbatim and will be opened in a basic text editor, so do NOT use Markdown syntax (no #, **, backticks, tables, links in brackets). Structure the text with blank lines, indentation, plain numbering (1., 2.) and simple dashes.
- Use "\\n" line breaks between lines; keep lines reasonably short.
- Write in the same language as the user. Cyrillic and other non-Latin text are preserved as UTF-8.
- Pass a short, human-readable file name in "title" (without the .txt extension).

Updating an existing file:
- Reproduce the ENTIRE file in "content" with ONLY the requested changes applied. Keep everything the user did not ask to change exactly as it was — line order, wording, spacing. Never return just the changed fragment; always emit the complete updated file.`,
    inputSchema: z.object({
      title: z
        .string()
        .describe(
          "Short, human-readable file name without the .txt extension."
        ),
      content: z
        .string()
        .describe(
          "The full file body as plain text (no Markdown). When updating an existing file, include the entire file, not just the changes."
        ),
    }),
    execute: async ({ title, content }) => {
      const id = generateUUID();
      try {
        const txtUrl = await uploadGeneratedTxt(content);

        await saveDocument({
          id,
          title,
          content: txtUrl,
          kind: "txt",
          userId,
        });

        return {
          id,
          txtUrl,
          title,
          content: "Text file was generated and uploaded successfully.",
        };
      } catch (error) {
        console.error("Failed to generate text file", error);
        return {
          id,
          txtUrl: undefined as string | undefined,
          title,
          content: "Failed to generate the text file.",
        };
      }
    },
  });

export const generateTxt = generateTxtTool;
