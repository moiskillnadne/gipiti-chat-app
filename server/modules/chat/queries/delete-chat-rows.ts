import { asc, eq, inArray } from "drizzle-orm";

import { type DatabaseExecutor, db } from "@/server/db/connection";
import { chat, message, stream, vote } from "@/server/db/schema";

/**
 * Deletes a chat and what hangs on it: votes, messages, streams, then the
 * chat. Does not check who owns it; the service does that first. Run it in a
 * transaction (pass it as `executor`): half a chat must never be left behind.
 */
export const deleteChatRows = async (
  { chatId }: { chatId: string },
  executor: DatabaseExecutor = db
): Promise<void> => {
  await executor.delete(vote).where(eq(vote.chatId, chatId));
  await executor.delete(message).where(eq(message.chatId, chatId));
  await executor.delete(stream).where(eq(stream.chatId, chatId));
  await executor.delete(chat).where(eq(chat.id, chatId));
};

/**
 * Deletes every chat of a user, with votes, messages and streams, and says
 * how many chats went.
 *
 * The chat rows are locked FIRST, in id order, and only then their children
 * are deleted. Every other write on a chat (delete one, vote, delete
 * trailing messages) also locks its chat row before it touches a child, so
 * all of them take locks in the same order and cannot deadlock: deleting the
 * children first and the chats last would let a concurrent writer hold chat X
 * and wait for a child this call has deleted while this call waits for X.
 * The fixed id order keeps two delete-alls from waiting on each other.
 *
 * The children are named by a subquery, not a list of ids, so a user with
 * very many chats cannot exceed the parameter limit.
 */
export const deleteChatRowsOfUser = async (
  { userId }: { userId: string },
  executor: DatabaseExecutor = db
): Promise<number> => {
  await executor
    .select({ id: chat.id })
    .from(chat)
    .where(eq(chat.userId, userId))
    .orderBy(asc(chat.id))
    .for("update");

  const userChatIds = executor
    .select({ id: chat.id })
    .from(chat)
    .where(eq(chat.userId, userId));

  await executor.delete(vote).where(inArray(vote.chatId, userChatIds));
  await executor.delete(message).where(inArray(message.chatId, userChatIds));
  await executor.delete(stream).where(inArray(stream.chatId, userChatIds));
  const deletedChats = await executor
    .delete(chat)
    .where(eq(chat.userId, userId))
    .returning({ id: chat.id });

  return deletedChats.length;
};
