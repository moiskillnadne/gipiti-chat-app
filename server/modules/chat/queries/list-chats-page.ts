import { and, desc, eq, lte, type SQL, sql } from "drizzle-orm";

import { type DatabaseExecutor, db } from "@/server/db/connection";
import { chat } from "@/server/db/schema";

/**
 * The cursor's text for `createdAt`: always six fractional digits, and
 * independent of the session's `DateStyle` (`::text` is ISO only under the
 * default setting). `::timestamp` reads this form back under any setting.
 */
const CREATED_AT_TEXT_FORMAT = "YYYY-MM-DD HH24:MI:SS.US";

export type ChatPageRow = {
  id: string;
  title: string;
  createdAt: Date;
  /**
   * The database's own text for `createdAt`, with every digit it stores
   * (microseconds). A cursor carries this, not `createdAt`: a `Date` holds
   * milliseconds only.
   */
  createdAtText: string;
};

export type ChatPage = { rows: ChatPageRow[]; hasMore: boolean };

/** Where the previous page ended, as `encodeCursor` carries it. */
export type ChatPagePosition = { createdAt: string; id: string };

/**
 * One page of a user's chats, newest first, by keyset: the rows strictly
 * before `(createdAt, id)` of `after`, ordered by `createdAt DESC, id DESC`.
 *
 * - The position is compared as a `timestamp` cast from the text the
 *   previous page selected, so chats that share a millisecond, or differ only
 *   below it, are neither skipped nor repeated. The id breaks exact ties.
 * - `after` is only a position. It is never looked up as a chat, and the
 *   query always filters by `userId`, so a position taken from another user's
 *   list returns only the caller's own chats before that point.
 * - `createdAt <= position` is repeated beside the row comparison because it
 *   is a range on the second column of `chat_user_created_idx (userId,
 *   createdAt)`: the index narrows the scan to the older chats, the row
 *   comparison then decides the ties.
 * - Fetches one row more than `limit` to know whether a next page exists.
 *
 * `buildChatPageQuery` is the query before it runs; it is exported so a test
 * can ask the planner about it.
 */
export const buildChatPageQuery = (
  {
    userId,
    limit,
    after,
  }: { userId: string; limit: number; after: ChatPagePosition | null },
  executor: DatabaseExecutor = db
) => {
  const isBeforePosition: SQL | undefined = after
    ? and(
        lte(chat.createdAt, sql`${after.createdAt}::timestamp`),
        sql`(${chat.createdAt}, ${chat.id}) < (${after.createdAt}::timestamp, ${after.id}::uuid)`
      )
    : undefined;

  return executor
    .select({
      id: chat.id,
      title: chat.title,
      createdAt: chat.createdAt,
      createdAtText: sql<string>`to_char(${chat.createdAt}, ${CREATED_AT_TEXT_FORMAT})`,
    })
    .from(chat)
    .where(and(eq(chat.userId, userId), isBeforePosition))
    .orderBy(desc(chat.createdAt), desc(chat.id))
    .limit(limit + 1);
};

export const listChatsPage = async (
  args: { userId: string; limit: number; after: ChatPagePosition | null },
  executor: DatabaseExecutor = db
): Promise<ChatPage> => {
  const rows = await buildChatPageQuery(args, executor);
  const hasMore = rows.length > args.limit;

  return { rows: hasMore ? rows.slice(0, args.limit) : rows, hasMore };
};
