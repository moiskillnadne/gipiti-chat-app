import { tool } from "ai";
import z from "zod/v4";
import { saveDocument } from "../../db/query/document/save-document";
import { generateUUID } from "../../utils";
import { createXlsxBuffer } from "../generate-xlsx-document";
import { uploadGeneratedXlsx } from "../media-upload";

type GenerateXlsxProps = {
  userId: string;
  chatId: string;
};

const cellSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.object({
    formula: z
      .string()
      .describe('Excel formula without the leading "=", e.g. "SUM(B2:B9)".'),
  }),
]);

const sheetSchema = z.object({
  name: z.string().describe("Sheet (tab) name."),
  columns: z
    .array(z.string())
    .optional()
    .describe("Optional header labels rendered as a bold first row."),
  rows: z
    .array(z.array(cellSchema))
    .describe(
      "Row-major 2D array of cell values (data rows, excluding the header)."
    ),
});

export const generateXlsxTool = ({ userId }: GenerateXlsxProps) =>
  tool({
    description: `Generate a downloadable Excel (.xlsx) spreadsheet from structured tabular data.

Use this tool when:
- The user explicitly asks to create, make, generate, export, or download a spreadsheet/Excel/таблицу/xlsx (e.g. "сделай таблицу Excel", "сделай xlsx", "create a spreadsheet", "экспортируй в Excel").
- The user wants tabular data delivered as a file they can open in Excel, Numbers, or Google Sheets.

Prefer updateXlsx instead when the user asks to modify, extend, or edit a spreadsheet that is already in the conversation (uploaded or generated earlier) — that preserves the existing cells and formatting. Do NOT use this tool when:
- The user just wants an answer in chat and did not ask for a file.
- The user wants to read or analyze an attached spreadsheet without producing a new file — answer directly instead.

How to author the workbook:
- Pass one or more sheets in "sheets". Each sheet has a "name", optional "columns" (header labels rendered as a bold first row), and "rows" — a row-major 2D array of cell values.
- Each cell is a string, number, boolean, null (empty cell), or a formula object: { "formula": "SUM(B2:B9)" } (no leading "="). Use formulas for totals, averages, and computed columns so the file stays live.
- Use multiple entries in "sheets" to produce a multi-sheet workbook.
- Write in the same language as the user. Cyrillic and other non-Latin text render correctly.
- Pass a short, human-readable name in "title" (used as the file name and workbook metadata).`,
    inputSchema: z.object({
      title: z
        .string()
        .describe(
          "Short, human-readable workbook name (used as the file name)."
        ),
      sheets: z
        .array(sheetSchema)
        .min(1)
        .describe("One or more sheets to include in the workbook."),
    }),
    execute: async ({ title, sheets }) => {
      const id = generateUUID();
      try {
        const buffer = await createXlsxBuffer({ title, sheets });
        const xlsxUrl = await uploadGeneratedXlsx(buffer);

        await saveDocument({
          id,
          title,
          content: xlsxUrl,
          kind: "xlsx",
          userId,
        });

        return {
          id,
          xlsxUrl,
          title,
          content: "XLSX was generated and uploaded successfully.",
        };
      } catch (error) {
        console.error("Failed to generate XLSX", error);
        return {
          id,
          xlsxUrl: undefined as string | undefined,
          title,
          content: "Failed to generate the XLSX document.",
        };
      }
    },
  });

export const generateXlsx = generateXlsxTool;
