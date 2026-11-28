import { db } from "@/server/db/connection";
import { deleteChatRowsOfUser } from "@/server/modules/chat/queries/delete-chat-rows";

/**
 * Deletes every chat of the user, with votes, messages and streams, in ONE
 * transaction. Returns how many chats went; 0 is not an error.
 */
export const deleteAllChatsForUser = async ({
  userId,
}: {
  userId: string;
}): Promise<{ deletedCount: number }> =>
  await db.transaction(async (tx) => ({
    deletedCount: await deleteChatRowsOfUser({ userId }, tx),
  }));
