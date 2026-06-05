import { chatModelIds } from "@/lib/ai/models";
import type { PromptCategoryId } from "@/lib/prompts/prompt-meta";

/**
 * One raw row read from the Google Sheet, with columns already mapped to their
 * canonical field names. Values are untrimmed strings (or `undefined` when the
 * column is absent). `rowNumber` is the 1-based sheet row for error reporting.
 */
export type SheetRow = {
  rowNumber: number;
  key?: string;
  category?: string;
  model?: string;
  title?: string;
  body?: string;
  tags?: string;
  active?: string;
  order?: string;
};

/** A validated, normalized prompt ready to be reconciled into the catalog. */
export type PromptSeed = {
  key: string;
  category: PromptCategoryId;
  modelId: string;
  title: string;
  body: string;
  tags: string[];
  isActive: boolean;
  sortOrder: number;
};

export type RowError = {
  rowNumber: number;
  key?: string;
  messages: string[];
};

export type ValidationResult = {
  seeds: PromptSeed[];
  errors: RowError[];
};

const MAX_KEY_LENGTH = 64;
const MAX_TITLE_LENGTH = 200;

// The category column accepts the canonical id or its Russian label (mirroring
// the `promptLibrary.category*` keys in messages/ru.json), so non-technical
// editors can pick from a Russian dropdown.
const CATEGORY_ALIASES: Record<string, PromptCategoryId> = {
  text: "text",
  текст: "text",
  code: "code",
  код: "code",
  image: "image",
  изображения: "image",
  video: "video",
  видео: "video",
  research: "research",
  анализ: "research",
  marketing: "marketing",
  маркетинг: "marketing",
  learning: "learning",
  обучение: "learning",
};

// Recognized "off" values for the `active` column. Anything else (including an
// empty cell) keeps the prompt active.
const FALSY_ACTIVE = new Set(["false", "0", "no", "n", "нет", "off"]);

const VALID_MODEL_IDS = new Set<string>(chatModelIds);

const TAG_SEPARATOR = /[;,]/;

function normalizeTags(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }

  const seen = new Set<string>();
  const tags: string[] = [];
  for (const part of raw.split(TAG_SEPARATOR)) {
    const tag = part.trim();
    if (tag && !seen.has(tag)) {
      seen.add(tag);
      tags.push(tag);
    }
  }
  return tags;
}

function normalizeActive(raw: string | undefined): boolean {
  if (raw === undefined) {
    return true;
  }
  return !FALSY_ACTIVE.has(raw.trim().toLowerCase());
}

function resolveSortOrder(
  raw: string | undefined,
  fallbackOrder: number,
  messages: string[]
): number {
  if (raw === undefined || raw.trim() === "") {
    return fallbackOrder;
  }

  const parsed = Number(raw.trim());
  if (Number.isInteger(parsed)) {
    return parsed;
  }

  messages.push(`'order' must be a whole number: "${raw}"`);
  return fallbackOrder;
}

function normalizeRow(
  row: SheetRow,
  fallbackOrder: number
): { seed?: PromptSeed; error?: RowError } {
  const messages: string[] = [];

  const key = row.key?.trim() ?? "";
  const title = row.title?.trim() ?? "";
  const body = row.body?.trim() ?? "";
  const categoryRaw = row.category?.trim() ?? "";
  const modelId = row.model?.trim() ?? "";

  if (key === "") {
    messages.push("Missing 'key'");
  } else if (key.length > MAX_KEY_LENGTH) {
    messages.push(`'key' exceeds ${MAX_KEY_LENGTH} characters`);
  }

  if (title === "") {
    messages.push("Missing 'title'");
  } else if (title.length > MAX_TITLE_LENGTH) {
    messages.push(`'title' exceeds ${MAX_TITLE_LENGTH} characters`);
  }

  if (body === "") {
    messages.push("Missing 'body'");
  }

  const category = CATEGORY_ALIASES[categoryRaw.toLowerCase()];
  if (categoryRaw === "") {
    messages.push("Missing 'category'");
  } else if (!category) {
    messages.push(`Unknown 'category': "${categoryRaw}"`);
  }

  if (modelId === "") {
    messages.push("Missing 'model'");
  } else if (!VALID_MODEL_IDS.has(modelId)) {
    messages.push(`Unknown 'model': "${modelId}"`);
  }

  const sortOrder = resolveSortOrder(row.order, fallbackOrder, messages);

  if (messages.length > 0 || !category) {
    return {
      error: {
        rowNumber: row.rowNumber,
        key: key || undefined,
        messages,
      },
    };
  }

  return {
    seed: {
      key,
      category,
      modelId,
      title,
      body,
      tags: normalizeTags(row.tags),
      isActive: normalizeActive(row.active),
      sortOrder,
    },
  };
}

/**
 * Validates and normalizes sheet rows into prompt seeds. Returns the valid
 * seeds plus a per-row error list; callers must treat a non-empty `errors`
 * list as a hard stop (never apply a partial sync).
 */
export function validateSheetRows(rows: SheetRow[]): ValidationResult {
  const seeds: PromptSeed[] = [];
  const errors: RowError[] = [];
  const keyToRow = new Map<string, number>();
  let validIndex = 0;

  for (const row of rows) {
    const { seed, error } = normalizeRow(row, validIndex);

    if (error || !seed) {
      if (error) {
        errors.push(error);
      }
      continue;
    }

    const firstSeenRow = keyToRow.get(seed.key);
    if (firstSeenRow !== undefined) {
      errors.push({
        rowNumber: row.rowNumber,
        key: seed.key,
        messages: [`Duplicate 'key' (first seen on row ${firstSeenRow})`],
      });
      continue;
    }

    keyToRow.set(seed.key, row.rowNumber);
    seeds.push(seed);
    validIndex += 1;
  }

  return { seeds, errors };
}
