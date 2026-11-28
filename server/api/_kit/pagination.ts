import { z } from "zod/v4";

/**
 * Cursor pagination for v1 lists that can grow without bound (chats, and
 * later transactions and card payments). A list a user cannot grow large is
 * returned whole as `{ items }` instead.
 *
 * Contract-zone file: it imports only `zod`, so a contract can use it.
 *
 * A page is `{ items, nextCursor }`, newest first. `nextCursor` is the
 * `cursor` of the next request, or `null` on the last page. A cursor is
 * opaque to clients: they pass back what they were given and nothing else.
 * It is only a POSITION in the list, `(createdAt, id)` of the last item of
 * the page, never a reference to a row, so a cursor taken from another
 * user's list reveals nothing: the query still filters by the caller.
 */

export const DEFAULT_PAGE_LIMIT = 20;
export const MIN_PAGE_LIMIT = 1;
export const MAX_PAGE_LIMIT = 100;
const MAX_CURSOR_LENGTH = 512;
const LIMIT_TEXT_PATTERN = /^\d{1,3}$/;

export const pageQuerySchema = z.object({
  // A query string holds text, so the number is read from it, but only from
  // one to three decimal digits: `Number(...)` would also take `1e1`, `0x10`
  // and ` 5`. Anything else (including an array, from `limit[]=5` or a
  // repeated `limit`) is passed on unchanged and fails the number schema, so
  // the generated schema stays `integer`, 1..100, default 20.
  limit: z
    .preprocess(
      (value) =>
        typeof value === "string" && LIMIT_TEXT_PATTERN.test(value)
          ? Number(value)
          : value,
      z
        .number()
        .int()
        .min(MIN_PAGE_LIMIT)
        .max(MAX_PAGE_LIMIT)
        .default(DEFAULT_PAGE_LIMIT)
    )
    .meta({
      description: `How many items to return, ${MIN_PAGE_LIMIT} to ${MAX_PAGE_LIMIT}. Defaults to ${DEFAULT_PAGE_LIMIT}.`,
    }),
  cursor: z.string().min(1).max(MAX_CURSOR_LENGTH).optional().meta({
    description:
      "The `nextCursor` of the previous page. Leave it out for the first page. Treat it as opaque.",
  }),
});

export type PageQuery = z.infer<typeof pageQuerySchema>;

/** The output of a paged list, for any item schema. */
export const pageOutputSchema = <TItem extends z.ZodType>(
  itemSchema: TItem
): z.ZodObject<{
  items: z.ZodArray<TItem>;
  nextCursor: z.ZodNullable<z.ZodString>;
}> =>
  z.object({
    items: z.array(itemSchema),
    nextCursor: z.string().nullable().meta({
      description:
        "Pass it as `cursor` to get the next page. `null` on the last page.",
    }),
  });

/**
 * Where a page ends: the creation time of its last item and that item's id.
 *
 * `createdAt` is the database's own text for a `timestamp` column
 * (`2026-01-01 00:00:00.123456`, up to microseconds, no time zone), not a
 * JavaScript date: a `Date` holds milliseconds, so chats created within the
 * same millisecond would be skipped or repeated at a page edge. The id breaks
 * ties between items with the same time.
 */
export type CursorPosition = { createdAt: string; id: string };

export type DecodedCursor =
  | { status: "ok"; position: CursorPosition }
  | { status: "invalid" };

const TIMESTAMP_TEXT_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2}) ([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(\.\d{1,6})?$/;
const BASE64_URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const BASE64_BLOCK_LENGTH = 4;
const TRAILING_PADDING_PATTERN = /=+$/;

/**
 * True for text the database accepts as a `timestamp` and nothing else: a
 * date that exists (no 30 February) in years 1 to 9999. A cursor that passes
 * is safe to cast in SQL.
 */
const isTimestampText = (text: string): boolean => {
  const match = TIMESTAMP_TEXT_PATTERN.exec(text);
  if (!match) {
    return false;
  }

  const [year, month, day] = [match[1], match[2], match[3]].map(Number);
  if (year < 1 || month < 1 || month > 12) {
    return false;
  }

  // Date.UTC rolls an impossible day over to the next month.
  return new Date(Date.UTC(year, month - 1, day)).getUTCDate() === day;
};

const cursorPositionSchema = z
  .object({
    createdAt: z.string().refine(isTimestampText),
    id: z.uuid(),
  })
  .strict();

const toBase64Url = (text: string): string =>
  btoa(text)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(TRAILING_PADDING_PATTERN, "");

const fromBase64Url = (encoded: string): string => {
  const standard = encoded.replaceAll("-", "+").replaceAll("_", "/");
  const padding =
    (BASE64_BLOCK_LENGTH - (standard.length % BASE64_BLOCK_LENGTH)) %
    BASE64_BLOCK_LENGTH;

  return atob(standard + "=".repeat(padding));
};

/** The opaque cursor for a position: base64url of a small JSON object. */
export const encodeCursor = (position: CursorPosition): string =>
  toBase64Url(
    JSON.stringify({ createdAt: position.createdAt, id: position.id })
  );

/**
 * Reads a cursor back. Never throws: anything that is not a cursor this
 * module wrote (not base64url, not JSON, wrong shape, an impossible date, a
 * bad id, extra fields) is `invalid`, which the endpoint answers with 400.
 */
export const decodeCursor = (cursor: string): DecodedCursor => {
  if (!BASE64_URL_PATTERN.test(cursor)) {
    return { status: "invalid" };
  }

  try {
    const parsed = cursorPositionSchema.safeParse(
      JSON.parse(fromBase64Url(cursor))
    );

    return parsed.success
      ? { status: "ok", position: parsed.data }
      : { status: "invalid" };
  } catch {
    // atob or JSON.parse refused the text.
    return { status: "invalid" };
  }
};
