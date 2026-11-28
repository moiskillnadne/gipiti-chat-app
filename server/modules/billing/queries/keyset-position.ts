import { and, lte, type SQL, sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

/**
 * The cursor's text for a `createdAt` column: always six fractional digits,
 * and independent of the session's `DateStyle` (`::text` is ISO only under
 * the default setting). `::timestamp` reads this form back under any setting.
 */
export const CREATED_AT_TEXT_FORMAT = "YYYY-MM-DD HH24:MI:SS.US";

/** Where the previous page ended, as `encodeCursor` carries it. */
export type KeysetPosition = { createdAt: string; id: string };

/** The database's own text for a `timestamp` column, at full precision. */
export const createdAtText = (createdAtColumn: PgColumn): SQL<string> =>
  sql<string>`to_char(${createdAtColumn}, ${CREATED_AT_TEXT_FORMAT})`;

/**
 * The rows strictly before `after` in the order `createdAt DESC, id DESC`, or
 * no condition for the first page.
 *
 * `createdAt <= position` is repeated beside the row comparison because it is
 * a range on the second column of an index `(user_id, created_at)`: the index
 * narrows the scan to the older rows, the row comparison then decides ties.
 */
export const isBeforePosition = (
  createdAtColumn: PgColumn,
  idColumn: PgColumn,
  after: KeysetPosition | null
): SQL | undefined =>
  after
    ? and(
        lte(createdAtColumn, sql`${after.createdAt}::timestamp`),
        sql`(${createdAtColumn}, ${idColumn}) < (${after.createdAt}::timestamp, ${after.id}::uuid)`
      )
    : undefined;
