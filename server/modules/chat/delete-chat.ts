import { db } from "@/server/db/connection";
import { deleteChatRows } from "@/server/modules/chat/queries/delete-chat-rows";
import { getChatOwnedByUser } from "@/server/modules/chat/queries/get-chat-owned-by-user";

export type DeleteChatResult =
  | { status: "deleted" }
  /** No such chat, or it is another user's: one answer for both. */
  | { status: "chat_not_found" };

/**
 * Deletes a chat of the user with its votes, messages and streams, in ONE
 * transaction: either everything goes or nothing does. The ownership check
 * runs inside it and locks the chat row, so a chat turn that is saving a
 * message waits for the delete instead of racing it.
 */
export const deleteChatForUser = async ({
  userId,
  chatId,
}: {
  userId: string;
  chatId: string;
}): Promise<DeleteChatResult> =>
  await db.transaction(async (tx): Promise<DeleteChatResult> => {
    const chat = await getChatOwnedByUser(
      { chatId, userId, lock: "update" },
      tx
    );
    if (!chat) {
      return { status: "chat_not_found" };
    }

    await deleteChatRows({ chatId }, tx);

    return { status: "deleted" };
  });
