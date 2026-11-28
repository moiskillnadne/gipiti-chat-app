import type { SheetRow } from "./prompt-seed";

/**
 * Identifies which Google Sheet (and tab) to read. The sheet must be shared as
 * "Anyone with the link can view" — the gviz endpoint reads it without auth, so
 * no service-account credential is required.
 */
export type SheetSource = {
  sheetId: string;
  gid?: string;
  sheetName?: string;
};

type CanonicalField =
  | "key"
  | "category"
  | "model"
  | "title"
  | "body"
  | "tags"
  | "active"
  | "order";

// Accepted header spellings (lowercased) per canonical field — English and
// Russian, so the sheet's header row can be in either language.
const HEADER_ALIASES: Record<CanonicalField, string[]> = {
  key: ["key", "ключ", "id"],
  category: ["category", "категория"],
  model: ["model", "modelid", "model_id", "модель"],
  title: ["title", "название", "заголовок"],
  body: ["body", "prompt", "промпт", "текст"],
  tags: ["tags", "теги", "тэги"],
  active: ["active", "isactive", "is_active", "активен", "активно"],
  order: ["order", "sort", "sortorder", "sort_order", "порядок"],
};

const REQUIRED_FIELDS: CanonicalField[] = [
  "key",
  "category",
  "model",
  "title",
  "body",
];

function buildHeaderMap(): Record<string, CanonicalField> {
  const map: Record<string, CanonicalField> = {};
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    for (const alias of aliases) {
      map[alias] = field as CanonicalField;
    }
  }
  return map;
}

const HEADER_TO_FIELD = buildHeaderMap();

type GvizCell = { v: string | number | boolean | null } | null;
type GvizRow = { c: GvizCell[] };
type GvizTable = { cols?: { label?: string }[]; rows?: GvizRow[] };
type GvizResponse = { table?: GvizTable };

function buildGvizUrl(source: SheetSource): string {
  const params = new URLSearchParams({ tqx: "out:json", headers: "1" });
  if (source.gid) {
    params.set("gid", source.gid);
  } else if (source.sheetName) {
    params.set("sheet", source.sheetName);
  }
  return `https://docs.google.com/spreadsheets/d/${source.sheetId}/gviz/tq?${params.toString()}`;
}

function cellToString(cell: GvizCell): string {
  if (cell?.v == null) {
    return "";
  }
  return String(cell.v);
}

function parseGvizPayload(text: string): GvizResponse {
  // The gviz endpoint wraps JSON in a JSONP-style callback, e.g.
  // `/*O_o*/ google.visualization.Query.setResponse({...});`. Slice between the
  // first "(" and the last ")" to recover the JSON object.
  const open = text.indexOf("(");
  const close = text.lastIndexOf(")");
  if (open === -1 || close === -1 || close <= open) {
    throw new Error(
      "Unexpected Google Sheets response. Ensure the sheet is shared as 'Anyone with the link can view'."
    );
  }
  return JSON.parse(text.slice(open + 1, close));
}

/**
 * Fetches prompt rows from a Google Sheet via the public gviz JSON endpoint.
 * Throws if the sheet is unreachable or is missing a required column.
 */
export async function fetchPromptSheetRows(
  source: SheetSource
): Promise<SheetRow[]> {
  const response = await fetch(buildGvizUrl(source));
  if (!response.ok) {
    throw new Error(
      `Google Sheet request failed: ${response.status} ${response.statusText}`
    );
  }

  const table = parseGvizPayload(await response.text()).table;
  if (!table?.cols) {
    throw new Error("Google Sheets response contained no table data.");
  }

  const fieldByColumn = table.cols.map((col) =>
    col.label ? HEADER_TO_FIELD[col.label.trim().toLowerCase()] : undefined
  );

  const presentFields = new Set(
    fieldByColumn.filter((field): field is CanonicalField => Boolean(field))
  );
  const missingFields = REQUIRED_FIELDS.filter(
    (field) => !presentFields.has(field)
  );
  if (missingFields.length > 0) {
    const foundHeaders = table.cols
      .map((col) => col.label ?? "")
      .filter(Boolean)
      .join(", ");
    throw new Error(
      `Sheet is missing required column(s): ${missingFields.join(", ")}. Found headers: ${foundHeaders}`
    );
  }

  const rows: SheetRow[] = [];
  for (const [index, gvizRow] of (table.rows ?? []).entries()) {
    const row: SheetRow = { rowNumber: index + 2 };
    let hasValue = false;

    for (const [columnIndex, field] of fieldByColumn.entries()) {
      if (!field) {
        continue;
      }
      const value = cellToString(gvizRow.c[columnIndex] ?? null);
      if (value !== "") {
        hasValue = true;
      }
      row[field] = value;
    }

    if (hasValue) {
      rows.push(row);
    }
  }

  return rows;
}
