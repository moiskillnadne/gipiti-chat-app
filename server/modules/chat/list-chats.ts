import {
  type ChatPagePosition,
  type ChatPageRow,
  listChatsPage,
} from "@/server/modules/chat/queries/list-chats-page";

export type ListChatsResult = {
  chats: ChatPageRow[];
  /** A next page exists; it starts after the last of `chats`. */
  hasMore: boolean;
};

/**
 * One page of the user's chats, newest first. `after` is the position the
 * previous page ended at; it is only a position, never a chat to look up, so
 * it can reveal nothing about anyone's chats.
 */
export const listChats = async ({
  userId,
  limit,
  after,
}: {
  userId: string;
  limit: number;
  after: ChatPagePosition | null;
}): Promise<ListChatsResult> => {
  const page = await listChatsPage({ userId, limit, after });

  return { chats: page.rows, hasMore: page.hasMore };
};
