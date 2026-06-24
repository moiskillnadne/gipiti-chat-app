import "server-only";

import ExcelJS from "exceljs";
import {
  sanitizeSheetName,
  toExcelCellValue,
  type XlsxCellInput,
} from "./generate-xlsx-document";

/** Append a new worksheet, optionally with a bold header row and data rows. */
export type XlsxAddSheetOperation = {
  type: "addSheet";
  name: string;
  columns?: string[];
  rows?: XlsxCellInput[][];
};

/** Append a row of values to the bottom of an existing sheet. */
export type XlsxAddRowOperation = {
  type: "addRow";
  sheet: string;
  values: XlsxCellInput[];
};

/** Append a new column at the right edge of an existing sheet. */
export type XlsxAddColumnOperation = {
  type: "addColumn";
  sheet: string;
  header?: string;
  values?: XlsxCellInput[];
};

/** Set a single cell by A1-style address (e.g. "B2"). */
export type XlsxSetCellOperation = {
  type: "setCell";
  sheet: string;
  cell: string;
  value: XlsxCellInput;
};

export type XlsxDeleteRowOperation = {
  type: "deleteRow";
  sheet: string;
  rowNumber: number;
};

export type XlsxDeleteColumnOperation = {
  type: "deleteColumn";
  sheet: string;
  columnNumber: number;
};

export type XlsxOperation =
  | XlsxAddSheetOperation
  | XlsxAddRowOperation
  | XlsxAddColumnOperation
  | XlsxSetCellOperation
  | XlsxDeleteRowOperation
  | XlsxDeleteColumnOperation;

export type ApplyXlsxOperationsInput = {
  buffer: Buffer;
  operations: XlsxOperation[];
  title?: string;
};

const FIRST_ROW = 1;

/**
 * Resolve the worksheet an operation targets. Falls back to the only sheet when
 * the workbook has exactly one (so a mismatched/omitted name still works), and
 * throws a descriptive error otherwise so the caller can report a clean failure.
 */
const resolveExistingSheet = (
  workbook: ExcelJS.Workbook,
  name: string
): ExcelJS.Worksheet => {
  const byName = workbook.getWorksheet(name);
  if (byName) {
    return byName;
  }
  if (workbook.worksheets.length === 1) {
    return workbook.worksheets[0];
  }
  throw new Error(`Sheet "${name}" not found in the workbook.`);
};

const applyAddSheet = (
  workbook: ExcelJS.Workbook,
  operation: XlsxAddSheetOperation
): void => {
  const worksheet = workbook.addWorksheet(
    sanitizeSheetName(operation.name, workbook.worksheets.length)
  );
  if (operation.columns && operation.columns.length > 0) {
    const headerRow = worksheet.addRow(operation.columns);
    headerRow.font = { bold: true };
  }
  for (const row of operation.rows ?? []) {
    worksheet.addRow(row.map(toExcelCellValue));
  }
};

const applyAddColumn = (
  worksheet: ExcelJS.Worksheet,
  operation: XlsxAddColumnOperation
): void => {
  const newColumn = worksheet.columnCount + 1;
  let startRow = FIRST_ROW;
  if (operation.header != null) {
    const headerCell = worksheet.getCell(FIRST_ROW, newColumn);
    headerCell.value = operation.header;
    headerCell.font = { ...headerCell.font, bold: true };
    startRow = FIRST_ROW + 1;
  }
  const values = operation.values ?? [];
  for (const [index, value] of values.entries()) {
    worksheet.getCell(startRow + index, newColumn).value =
      toExcelCellValue(value);
  }
};

const applyOperation = (
  workbook: ExcelJS.Workbook,
  operation: XlsxOperation
): void => {
  if (operation.type === "addSheet") {
    applyAddSheet(workbook, operation);
    return;
  }

  const worksheet = resolveExistingSheet(workbook, operation.sheet);

  switch (operation.type) {
    case "addRow":
      worksheet.addRow(operation.values.map(toExcelCellValue));
      break;
    case "addColumn":
      applyAddColumn(worksheet, operation);
      break;
    case "setCell":
      worksheet.getCell(operation.cell).value = toExcelCellValue(
        operation.value
      );
      break;
    case "deleteRow":
      worksheet.spliceRows(operation.rowNumber, 1);
      break;
    case "deleteColumn":
      worksheet.spliceColumns(operation.columnNumber, 1);
      break;
    default:
      break;
  }
};

/**
 * Load an existing .xlsx buffer, apply structured edit operations, and return
 * the updated workbook as a Buffer. exceljs round-trips untouched cells,
 * formulas, merged ranges, number formats and column widths on load/save, so
 * everything the operations don't change is preserved. (Charts, pivot tables and
 * some conditional formatting are not preserved by exceljs.)
 */
export async function applyXlsxOperations({
  buffer,
  operations,
  title,
}: ApplyXlsxOperationsInput): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  // exceljs's bundled types declare `interface Buffer extends ArrayBuffer`,
  // which a real Node Buffer doesn't satisfy. The runtime value is a valid
  // Buffer, so cast through unknown to the type exceljs's `load` expects.
  await workbook.xlsx.load(
    buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]
  );

  if (title) {
    workbook.title = title;
  }

  for (const operation of operations) {
    applyOperation(workbook, operation);
  }

  const data = await workbook.xlsx.writeBuffer();
  return Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
}
