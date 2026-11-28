import {
  getChatOwnedByUser,
  type OwnedChat,
} from "@/server/modules/chat/queries/get-chat-owned-by-user";

export type GetChatResult =
  | { status: "ok"; chat: OwnedChat }
  /** No such chat, or it is another user's: one answer for both. */
  | { status: "chat_not_found" };

export const getChat = async ({
  userId,
  chatId,
}: {
  userId: string;
  chatId: string;
}): Promise<GetChatResult> => {
  const chat = await getChatOwnedByUser({ chatId, userId });

  return chat ? { status: "ok", chat } : { status: "chat_not_found" };
};
