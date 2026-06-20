import "server-only";

import ExcelJS from "exceljs";
import type { ChatMessage } from "../types";

/** OOXML spreadsheet (.xlsx) MIME type. */
export const XLSX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Cap the injected text so a huge workbook can't blow up the token budget. */
const MAX_EXTRACTED_CHARS = 200_000;

const PERCENT_PRECISION = 4;

type ChatMessagePart = ChatMessage["parts"][number];

type XlsxFilePart = {
  type: "file";
  mediaType: string;
  url: string;
  filename?: string;
  name?: string;
};

type FormulaCellValue = {
  formula?: string;
  sharedFormula?: string;
  result?: unknown;
};
type RichTextCellValue = { richText: Array<{ text: string }> };
type HyperlinkCellValue = { text: string; hyperlink: string };
type ErrorCellValue = { error: string };

const isXlsxFilePart = (
  part: ChatMessagePart
): part is ChatMessagePart & XlsxFilePart =>
  part.type === "file" &&
  (part as { mediaType?: string }).mediaType === XLSX_MIME_TYPE;

const labelOf = (part: XlsxFilePart): string =>
  part.filename ?? part.name ?? "таблица.xlsx";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/** Render a numeric value, expanding percent number-formats to a `%` string. */
const formatNumber = (value: number, numFmt: string | undefined): string => {
  if (numFmt?.includes("%")) {
    const percent = Number((value * 100).toFixed(PERCENT_PRECISION));
    return `${percent}%`;
  }
  return String(value);
};

/** Midnight-UTC dates collapse to `YYYY-MM-DD`; anything with a time keeps ISO. */
const formatDate = (value: Date): string => {
  const isMidnightUtc =
    value.getUTCHours() === 0 &&
    value.getUTCMinutes() === 0 &&
    value.getUTCSeconds() === 0 &&
    value.getUTCMilliseconds() === 0;
  const iso = value.toISOString();
  return isMidnightUtc ? iso.slice(0, 10) : iso;
};

/** Convert a scalar (also used for formula results) to display text. */
const scalarToText = (value: unknown, numFmt: string | undefined): string => {
  if (value == null) {
    return "";
  }
  if (value instanceof Date) {
    return formatDate(value);
  }
  if (typeof value === "number") {
    return formatNumber(value, numFmt);
  }
  if (typeof value === "boolean") {
    return String(value);
  }
  if (typeof value === "string") {
    return value;
  }
  if (isRecord(value) && "error" in value) {
    return String((value as ErrorCellValue).error);
  }
  return String(value);
};

/**
 * Turn a single cell into display text the model can read: dates as ISO,
 * percent-formatted numbers as `N%`, formulas as `result (=FORMULA)`, rich text
 * and hyperlinks flattened. Number formats other than percent keep the raw
 * value (the column header usually conveys currency/units).
 */
const cellToText = (cell: ExcelJS.Cell): string => {
  const { value } = cell;
  const numFmt = cell.numFmt;

  if (value == null) {
    return "";
  }

  if (isRecord(value)) {
    if ("formula" in value || "sharedFormula" in value) {
      const formulaValue = value as FormulaCellValue;
      const expression = formulaValue.formula ?? formulaValue.sharedFormula;
      const resultText = scalarToText(formulaValue.result, numFmt);
      if (resultText.length > 0) {
        return `${resultText} (=${expression})`;
      }
      return `=${expression}`;
    }
    if ("richText" in value) {
      return (value as RichTextCellValue).richText
        .map((run) => run.text)
        .join("");
    }
    if ("hyperlink" in value) {
      const link = value as HyperlinkCellValue;
      return `${link.text} (${link.hyperlink})`;
    }
  }

  return scalarToText(value, numFmt);
};

/** Escape pipe + newline so a value can't break the Markdown table grid. */
const escapeForTable = (text: string): string =>
  text.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");

/**
 * A merged region is rendered once (in its top-left master cell); every other
 * cell in the region must be blanked so the value isn't repeated across columns.
 */
const isMergedFollower = (cell: ExcelJS.Cell): boolean =>
  cell.isMerged && cell.master.address !== cell.address;

const renderSheet = (worksheet: ExcelJS.Worksheet): string => {
  const rowCount = worksheet.rowCount;
  const columnCount = Math.max(
    worksheet.columnCount,
    worksheet.actualColumnCount
  );
  const heading = `### Лист «${worksheet.name}» (${rowCount} строк × ${columnCount} столбцов)`;

  if (rowCount === 0 || columnCount === 0) {
    return `${heading}\n\n[пустой лист]`;
  }

  const lines: string[] = [heading, ""];
  for (let rowIndex = 1; rowIndex <= rowCount; rowIndex++) {
    const row = worksheet.getRow(rowIndex);
    const cells: string[] = [];
    for (let columnIndex = 1; columnIndex <= columnCount; columnIndex++) {
      const cell = row.getCell(columnIndex);
      const text = isMergedFollower(cell) ? "" : cellToText(cell);
      cells.push(escapeForTable(text));
    }
    lines.push(`| ${cells.join(" | ")} |`);
    if (rowIndex === 1) {
      lines.push(
        `| ${Array.from({ length: columnCount }, () => "---").join(" | ")} |`
      );
    }
  }

  const merges = worksheet.model.merges;
  if (merges.length > 0) {
    lines.push("", `Объединённые ячейки: ${merges.join(", ")}`);
  }

  return lines.join("\n");
};

/**
 * Extract every worksheet of an .xlsx buffer into readable text the model can
 * reason over: one Markdown table per sheet, with formula results, ISO dates,
 * percent values and merged-cell ranges surfaced. Output is length-capped so a
 * large workbook (1000+ rows) degrades gracefully instead of exhausting tokens.
 */
export async function extractXlsxText(buffer: Buffer): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  // exceljs's bundled types declare `interface Buffer extends ArrayBuffer`,
  // which a real Node Buffer doesn't satisfy. The runtime value is a valid
  // Buffer, so cast through unknown to the type exceljs's `load` expects.
  await workbook.xlsx.load(
    buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]
  );

  const sections: string[] = [];
  let totalLength = 0;
  let truncated = false;

  for (const worksheet of workbook.worksheets) {
    const section = renderSheet(worksheet);
    if (totalLength + section.length > MAX_EXTRACTED_CHARS) {
      truncated = true;
      break;
    }
    sections.push(section);
    totalLength += section.length;
  }

  let output = sections.join("\n\n");
  if (truncated) {
    output += "\n\n[таблица обрезана: содержимое слишком длинное]";
  }
  return output;
}

async function fetchAndExtract(url: string, label: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return `[Не удалось прочитать файл "${label}".]`;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const text = await extractXlsxText(buffer);
    return `Содержимое таблицы "${label}":\n\n${text}`;
  } catch (error) {
    console.error("Failed to extract XLSX", url, error);
    return `[Не удалось прочитать файл "${label}".]`;
  }
}

/**
 * Replace every .xlsx file part with a text part holding the workbook's
 * extracted content, so the model can read spreadsheets (LLM providers can't
 * read .xlsx natively the way they read PDFs). Operates on the model-facing
 * message copy only — the persisted user message keeps its file part so the UI
 * still renders the attachment chip. Image/PDF/DOCX parts are left untouched.
 */
export async function attachXlsxContentForModel(
  messages: ChatMessage[]
): Promise<ChatMessage[]> {
  return await Promise.all(
    messages.map(async (message) => {
      if (!message.parts.some(isXlsxFilePart)) {
        return message;
      }

      const parts: ChatMessagePart[] = [];
      for (const part of message.parts) {
        if (isXlsxFilePart(part)) {
          const text = await fetchAndExtract(part.url, labelOf(part));
          parts.push({ type: "text", text });
        } else {
          parts.push(part);
        }
      }

      return { ...message, parts };
    })
  );
}
