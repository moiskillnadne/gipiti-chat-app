import { getChatOwnedByUser } from "@/server/modules/chat/queries/get-chat-owned-by-user";
import { getVotesByChatId } from "@/server/modules/chat/queries/get-votes-by-chat-id";

export type ListChatVotesResult =
  | { status: "ok"; votes: { messageId: string; isUpvoted: boolean }[] }
  /** No such chat, or it is another user's. */
  | { status: "chat_not_found" };

export const listChatVotes = async ({
  userId,
  chatId,
}: {
  userId: string;
  chatId: string;
}): Promise<ListChatVotesResult> => {
  const chat = await getChatOwnedByUser({ chatId, userId });
  if (!chat) {
    return { status: "chat_not_found" };
  }

  const rows = await getVotesByChatId({ id: chatId });

  return {
    status: "ok",
    votes: rows.map(({ messageId, isUpvoted }) => ({ messageId, isUpvoted })),
  };
};
