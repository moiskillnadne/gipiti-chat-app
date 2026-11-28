import { and, eq } from "drizzle-orm";

import { type DatabaseExecutor, db } from "@/server/db/connection";
import { chat } from "@/server/db/schema";

export type OwnedChat = { id: string; title: string; createdAt: Date };

/**
 * `update` blocks other transactions from changing or deleting the chat (and
 * from adding a message to it) until this one ends; `share` blocks only the
 * deletion and changes of the row itself.
 */
export type ChatRowLock = "update" | "share";

/**
 * The chat, only when it belongs to the user: a missing chat and another
 * user's chat are both `null`, so a caller cannot tell them apart.
 *
 * Inside a transaction, pass it as `executor` and a `lock` to keep the
 * answer true until the transaction ends.
 */
export const getChatOwnedByUser = async (
  {
    chatId,
    userId,
    lock,
  }: { chatId: string; userId: string; lock?: ChatRowLock },
  executor: DatabaseExecutor = db
): Promise<OwnedChat | null> => {
  const query = executor
    .select({ id: chat.id, title: chat.title, createdAt: chat.createdAt })
    .from(chat)
    .where(and(eq(chat.id, chatId), eq(chat.userId, userId)))
    .limit(1);

  const [row] = lock ? await query.for(lock) : await query;

  return row ?? null;
};
