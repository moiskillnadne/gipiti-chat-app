import { db } from "@/server/db/connection";
import { deleteMessagesFrom } from "@/server/modules/chat/queries/delete-messages-from";
import { getChatOwnedByUser } from "@/server/modules/chat/queries/get-chat-owned-by-user";

export type RemoveMessagesFromResult =
  | { status: "removed" }
  /** No such chat, or it is another user's: one answer for both. */
  | { status: "chat_not_found" };

/**
 * Deletes a message of the user's chat and every later message of that chat
 * (when the user edits a message), with their votes, in ONE transaction. A
 * message that does not exist, or is in another chat, deletes nothing and is
 * still `removed`: the end state the caller asked for already holds.
 *
 * The chat row is locked, so a vote or a new message cannot slip in between
 * the check and the delete.
 */
export const removeMessagesFrom = async ({
  userId,
  chatId,
  messageId,
}: {
  userId: string;
  chatId: string;
  messageId: string;
}): Promise<RemoveMessagesFromResult> =>
  await db.transaction(async (tx): Promise<RemoveMessagesFromResult> => {
    const chat = await getChatOwnedByUser(
      { chatId, userId, lock: "update" },
      tx
    );
    if (!chat) {
      return { status: "chat_not_found" };
    }

    await deleteMessagesFrom({ chatId, messageId }, tx);

    return { status: "removed" };
  });
