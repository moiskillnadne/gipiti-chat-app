import "server-only";

import ExcelJS from "exceljs";

/** A cell whose value is a formula expression, e.g. `{ formula: "SUM(B2:B9)" }`. */
export type XlsxFormulaCell = { formula: string };

/** Any value a generated cell can hold. `null` writes an empty cell. */
export type XlsxCellInput = string | number | boolean | null | XlsxFormulaCell;

export type XlsxSheetInput = {
  name: string;
  columns?: string[];
  rows: XlsxCellInput[][];
};

export type CreateXlsxBufferInput = {
  title: string;
  sheets: XlsxSheetInput[];
};

/** Excel forbids these in sheet names and caps the length at 31 characters. */
const INVALID_SHEET_NAME_CHARS = /[*?:\\/[\]]/g;
const MAX_SHEET_NAME_LENGTH = 31;
const LEADING_EQUALS = /^=/;

const MIN_COLUMN_WIDTH = 10;
const MAX_COLUMN_WIDTH = 60;
const COLUMN_WIDTH_PADDING = 2;

const isFormulaCell = (cell: XlsxCellInput): cell is XlsxFormulaCell =>
  cell !== null && typeof cell === "object" && "formula" in cell;

/** Map a structured input cell to an exceljs cell value. Shared with updateXlsx. */
export const toExcelCellValue = (cell: XlsxCellInput): ExcelJS.CellValue => {
  if (isFormulaCell(cell)) {
    // Excel recalculates formulas on open, so no cached result is needed.
    return { formula: cell.formula.replace(LEADING_EQUALS, "") };
  }
  return cell;
};

/** Strip characters Excel forbids in sheet names and clamp to 31 chars. */
export const sanitizeSheetName = (name: string, index: number): string => {
  const cleaned = name.replace(INVALID_SHEET_NAME_CHARS, " ").trim();
  const fallback = `Лист${index + 1}`;
  return (cleaned || fallback).slice(0, MAX_SHEET_NAME_LENGTH);
};

/** Size each column to its widest cell, clamped to a sane range. */
const autoFitColumns = (worksheet: ExcelJS.Worksheet): void => {
  for (const column of worksheet.columns) {
    let maxLength = MIN_COLUMN_WIDTH;
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      const length = cell.text ? cell.text.length : 0;
      if (length > maxLength) {
        maxLength = length;
      }
    });
    column.width = Math.min(maxLength + COLUMN_WIDTH_PADDING, MAX_COLUMN_WIDTH);
  }
};

/**
 * Render a structured workbook description to an .xlsx Buffer using exceljs. One
 * worksheet per sheet; optional `columns` become a bold header row; formula
 * cells are written as live formulas. exceljs stores Unicode, so Cyrillic works
 * out of the box with no font bundling (unlike the PDF path).
 */
export async function createXlsxBuffer({
  title,
  sheets,
}: CreateXlsxBufferInput): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.title = title;
  workbook.creator = "GIPITI";

  for (const [index, sheet] of sheets.entries()) {
    const worksheet = workbook.addWorksheet(
      sanitizeSheetName(sheet.name, index)
    );

    if (sheet.columns && sheet.columns.length > 0) {
      const headerRow = worksheet.addRow(sheet.columns);
      headerRow.font = { bold: true };
    }

    for (const row of sheet.rows) {
      worksheet.addRow(row.map(toExcelCellValue));
    }

    autoFitColumns(worksheet);
  }

  const data = await workbook.xlsx.writeBuffer();
  return Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
}
