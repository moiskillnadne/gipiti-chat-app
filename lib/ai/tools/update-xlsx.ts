import { tool } from "ai";
import z from "zod/v4";
import { saveDocument } from "../../db/query/document/save-document";
import { generateUUID } from "../../utils";
import { uploadGeneratedXlsx } from "../media-upload";
import { applyXlsxOperations } from "../update-xlsx-document";

type UpdateXlsxProps = {
  userId: string;
  chatId: string;
  /** The most recent spreadsheet in the conversation, resolved by the caller. */
  latestXlsxUrl: string | undefined;
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

const operationSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("addSheet"),
    name: z.string().describe("Name of the new sheet."),
    columns: z
      .array(z.string())
      .optional()
      .describe("Optional bold header labels for the new sheet."),
    rows: z
      .array(z.array(cellSchema))
      .optional()
      .describe("Optional data rows for the new sheet."),
  }),
  z.object({
    type: z.literal("addRow"),
    sheet: z.string().describe("Name of the sheet to append a row to."),
    values: z.array(cellSchema).describe("Cell values for the new row."),
  }),
  z.object({
    type: z.literal("addColumn"),
    sheet: z.string().describe("Name of the sheet to append a column to."),
    header: z
      .string()
      .optional()
      .describe("Optional bold header for the new column (row 1)."),
    values: z
      .array(cellSchema)
      .optional()
      .describe("Cell values for the new column, top to bottom."),
  }),
  z.object({
    type: z.literal("setCell"),
    sheet: z.string().describe("Name of the sheet that contains the cell."),
    cell: z.string().describe('A1-style cell address, e.g. "B2".'),
    value: cellSchema.describe("New value for the cell."),
  }),
  z.object({
    type: z.literal("deleteRow"),
    sheet: z.string().describe("Name of the sheet to delete a row from."),
    rowNumber: z.number().int().describe("1-based row number to delete."),
  }),
  z.object({
    type: z.literal("deleteColumn"),
    sheet: z.string().describe("Name of the sheet to delete a column from."),
    columnNumber: z
      .number()
      .int()
      .describe("1-based column number to delete (A = 1)."),
  }),
]);

export const updateXlsxTool = ({ userId, latestXlsxUrl }: UpdateXlsxProps) =>
  tool({
    description: `Apply edits to the most recent Excel (.xlsx) spreadsheet in the conversation — one the user uploaded or that you generated earlier — preserving everything you don't change.

Use this tool when:
- The user asks to modify, update, extend, add to, or fix a spreadsheet that already exists in the conversation (e.g. "добавь колонку", "добавь строку", "добавь лист", "поменяй значение в ячейке B2", "удали строку 5").

Prefer generateXlsx instead when there is no existing spreadsheet to edit, or the user wants a brand-new file. Do NOT use this tool when the user only wants to read or analyze a spreadsheet without changing it — answer directly instead.

How it works:
- The latest spreadsheet in the conversation is loaded and your operations are applied on top of it. Untouched cells, formulas, merged ranges, number formats and column widths are preserved — only describe what should change.
- Provide a list of "operations". Supported types: addSheet, addRow, addColumn, setCell, deleteRow, deleteColumn.
- Identify the target sheet by its "sheet" name (use the names you saw when reading the file). Cell values can be a string, number, boolean, null, or a formula object { "formula": "SUM(B2:B9)" }.
- Row/column numbers are 1-based (column A = 1). Cyrillic text is fully supported.
- Pass a short "title" used as the updated file's name.`,
    inputSchema: z.object({
      title: z
        .string()
        .describe("Short, human-readable name for the updated file."),
      operations: z
        .array(operationSchema)
        .min(1)
        .describe("The edits to apply to the latest spreadsheet, in order."),
    }),
    execute: async ({ title, operations }) => {
      const id = generateUUID();

      if (!latestXlsxUrl) {
        return {
          id,
          xlsxUrl: undefined as string | undefined,
          title,
          content:
            "No spreadsheet found in the conversation to update. Use generateXlsx to create a new one instead.",
        };
      }

      try {
        const response = await fetch(latestXlsxUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch spreadsheet: ${response.status}`);
        }
        const buffer = Buffer.from(await response.arrayBuffer());

        const updated = await applyXlsxOperations({
          buffer,
          operations,
          title,
        });
        const xlsxUrl = await uploadGeneratedXlsx(updated);

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
          content: "XLSX was updated and uploaded successfully.",
        };
      } catch (error) {
        console.error("Failed to update XLSX", error);
        return {
          id,
          xlsxUrl: undefined as string | undefined,
          title,
          content: "Failed to update the XLSX document.",
        };
      }
    },
  });

export const updateXlsx = updateXlsxTool;
