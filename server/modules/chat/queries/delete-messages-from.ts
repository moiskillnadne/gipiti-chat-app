import { and, eq, gte, inArray, sql } from "drizzle-orm";

import { type DatabaseExecutor, db } from "@/server/db/connection";
import { message, vote } from "@/server/db/schema";

/**
 * Deletes a message of a chat and every later message of that chat (the same
 * time or later, so the message itself goes too), with their votes. Does
 * nothing when the message does not exist or belongs to another chat. Does
 * not check who owns the chat; the service does that first.
 *
 * The cut-off is read by a subquery from the message's own `createdAt`, so it
 * keeps every digit the database stores. Passing a JavaScript `Date` instead
 * would round it to milliseconds and delete messages that are a few
 * microseconds older. Run it in a transaction (pass it as `executor`): votes
 * go first, and if the messages then fail to go, the votes must come back.
 */
export const deleteMessagesFrom = async (
  { chatId, messageId }: { chatId: string; messageId: string },
  executor: DatabaseExecutor = db
): Promise<void> => {
  const cutOff = executor
    .select({ createdAt: message.createdAt })
    .from(message)
    .where(and(eq(message.id, messageId), eq(message.chatId, chatId)));

  const messageIdsToDelete = executor
    .select({ id: message.id })
    .from(message)
    .where(
      and(eq(message.chatId, chatId), gte(message.createdAt, sql`(${cutOff})`))
    );

  await executor
    .delete(vote)
    .where(
      and(eq(vote.chatId, chatId), inArray(vote.messageId, messageIdsToDelete))
    );
  await executor
    .delete(message)
    .where(
      and(eq(message.chatId, chatId), inArray(message.id, messageIdsToDelete))
    );
};
