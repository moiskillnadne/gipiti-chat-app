import { db } from "@/server/db/connection";
import { getChatOwnedByUser } from "@/server/modules/chat/queries/get-chat-owned-by-user";
import { isMessageInChat } from "@/server/modules/chat/queries/is-message-in-chat";
import { voteMessage } from "@/server/modules/chat/queries/vote-message";

export type SetMessageVoteResult =
  | { status: "voted" }
  /** No such chat, or it is another user's. */
  | { status: "chat_not_found" }
  /** No such message in that chat (it may exist in another chat). */
  | { status: "message_not_found" };

/**
 * Sets the user's vote on a message of their own chat; a later vote replaces
 * an earlier one, so repeating the call changes nothing. The chat row is
 * locked `share`, which lets other votes in at once and makes a concurrent
 * delete of the message or the chat wait, so the vote never points at a row
 * that has just gone.
 */
export const setMessageVote = async ({
  userId,
  chatId,
  messageId,
  isUpvoted,
}: {
  userId: string;
  chatId: string;
  messageId: string;
  isUpvoted: boolean;
}): Promise<SetMessageVoteResult> =>
  await db.transaction(async (tx): Promise<SetMessageVoteResult> => {
    const chat = await getChatOwnedByUser(
      { chatId, userId, lock: "share" },
      tx
    );
    if (!chat) {
      return { status: "chat_not_found" };
    }
    if (!(await isMessageInChat({ chatId, messageId }, tx))) {
      return { status: "message_not_found" };
    }

    await voteMessage(
      { chatId, messageId, type: isUpvoted ? "up" : "down" },
      tx
    );

    return { status: "voted" };
  });
