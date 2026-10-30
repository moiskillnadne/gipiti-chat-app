import { deleteMessagesByChatIdAfterTimestamp } from "@/lib/db/query/chat/delete-messages-by-chat-id-after-timestamp";
import { getChatById } from "@/lib/db/query/chat/get-chat-by-id";
import { getMessageById } from "@/lib/db/query/chat/get-message-by-id";
import { ChatSDKError } from "@/lib/errors";

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
