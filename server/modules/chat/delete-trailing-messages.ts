import { ChatSDKError } from "@/lib/errors";
import { deleteMessagesByChatIdAfterTimestamp } from "@/server/modules/chat/queries/delete-messages-by-chat-id-after-timestamp";
import { getChatById } from "@/server/modules/chat/queries/get-chat-by-id";
import { getMessageById } from "@/server/modules/chat/queries/get-message-by-id";

/**
 * Deletes a message and every later message in its chat (used when the user
 * edits a message). Only the chat owner may do this.
 *
 * A missing message is a no-op: there is nothing to delete.
 * Throws ChatSDKError("not_found:chat") / ("forbidden:chat") otherwise.
 */
export async function deleteTrailingMessagesForUser({
  messageId,
  userId,
}: {
  messageId: string;
  userId: string;
}): Promise<void> {
  const [message] = await getMessageById({ id: messageId });

  if (!message) {
    return;
  }

  const chat = await getChatById({ id: message.chatId });

  if (!chat) {
    throw new ChatSDKError("not_found:chat");
  }

  if (chat.userId !== userId) {
    throw new ChatSDKError("forbidden:chat");
  }

  await deleteMessagesByChatIdAfterTimestamp({
    chatId: message.chatId,
    timestamp: message.createdAt,
  });
}
