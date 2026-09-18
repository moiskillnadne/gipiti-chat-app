import { tool } from "ai";
import z from "zod/v4";
import { saveDocument } from "../../db/query/document/save-document";
import { generateUUID } from "../../utils";
import { uploadGeneratedCsv } from "../media-upload";

type GenerateCsvProps = {
  userId: string;
  chatId: string;
};

export const generateCsvTool = ({ userId }: GenerateCsvProps) =>
  tool({
    description: `Generate a downloadable CSV (.csv) table file, OR produce an updated version of a .csv / .tsv file already in the conversation.

Use this tool when:
- The user asks to create, make, generate, export, save, or download a CSV / table / spreadsheet-ready file (e.g. "сделай csv", "выгрузи в таблицу", "сохрани как csv", "файл для Excel", "export to CSV").
- The user wants tabular data delivered as a file that opens in Excel, Numbers or Google Sheets.
- The user asks to modify an attached .csv / .tsv file — add or remove a column or row, filter, sort, fix values — and wants the updated file back.

Prefer generateTxt, generateMarkdown, generateDocx or generatePdf when the user asks for those formats. Do NOT use this tool when:
- The user only wants to read, summarize, or analyze an attached CSV — answer directly instead.
- The user wants a small table shown in chat; a Markdown table in the reply does not need a file.

How to author the file (RFC 4180):
- Pass the COMPLETE file in "content": the header row first, then one record per line, every row with the same number of fields.
- Use "," as the delimiter unless the user asks otherwise or you are updating an attached file — then keep that file's delimiter (Russian-locale Excel exports use ";").
- Wrap a field in double quotes when it contains the delimiter, a double quote or a line break, and double any quote inside it: "Ноутбук 15"" Pro".
- Only the table: no Markdown, no code fences, no commentary, no blank lines between rows.
- Numbers as plain digits; keep the decimal separator of the source file when updating.
- Write in the same language as the user. The file is saved as UTF-8 with BOM, so Cyrillic opens correctly in Excel.
- Pass a short, human-readable file name in "title" (without the .csv extension).

Updating an existing file:
- Reproduce the ENTIRE file in "content" with ONLY the requested changes applied. Keep the header, column order, delimiter, quoting and every untouched row exactly as they were. Never return just the changed fragment; always emit the complete updated file.`,
    inputSchema: z.object({
      title: z
        .string()
        .describe(
          "Short, human-readable file name without the .csv extension."
        ),
      content: z
        .string()
        .describe(
          "The full CSV file: header row, then one record per line, RFC 4180 quoting. When updating an existing file, include the entire file, not just the changes."
        ),
    }),
    execute: async ({ title, content }) => {
      const id = generateUUID();
      try {
        const csvUrl = await uploadGeneratedCsv(content);

        await saveDocument({
          id,
          title,
          content: csvUrl,
          kind: "csv",
          userId,
        });

        return {
          id,
          csvUrl,
          title,
          content: "CSV file was generated and uploaded successfully.",
        };
      } catch (error) {
        console.error("Failed to generate CSV file", error);
        return {
          id,
          csvUrl: undefined as string | undefined,
          title,
          content: "Failed to generate the CSV file.",
        };
      }
    },
  });

export const generateCsv = generateCsvTool;
