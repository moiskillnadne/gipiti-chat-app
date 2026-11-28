import type {
  ChatDto,
  ChatListDto,
  ChatVotesDto,
} from "@/client/shared/api/types";

/** The pages of the sidebar history as `useSWRInfinite` holds them. */
export type ChatHistoryPages = ChatListDto[] | undefined;

/** The chat with this id, wherever it sits in the loaded pages. */
export const findChat = (
  pages: ChatHistoryPages,
  chatId: string
): ChatDto | undefined =>
  pages?.flatMap((page) => page.items).find((chat) => chat.id === chatId);

/** The pages without one chat. Removing a chat that is not there changes nothing. */
export const withoutChat = (
  pages: ChatHistoryPages,
  chatId: string
): ChatHistoryPages =>
  pages?.map((page) => ({
    ...page,
    items: page.items.filter((chat) => chat.id !== chatId),
  }));

/**
 * The pages with a removed chat put back where its date puts it: into the
 * first page after which the next page starts with an older chat (or into the
 * last page), at its sorted place. So a chat that sat at the end of a page
 * goes back to that page. A chat that is already there is not added twice.
 */
export const withChatRestored = (
  pages: ChatHistoryPages,
  chat: ChatDto
): ChatHistoryPages => {
  if (!pages || pages.length === 0 || findChat(pages, chat.id)) {
    return pages;
  }
  const restoredTime = Date.parse(chat.createdAt);
  const targetIndex = pages.findIndex((_page, index) => {
    const nextPageHead = pages[index + 1]?.items[0];

    return !nextPageHead || Date.parse(nextPageHead.createdAt) <= restoredTime;
  });
  const pageIndex = targetIndex === -1 ? pages.length - 1 : targetIndex;

  return pages.map((page, index) => {
    if (index !== pageIndex) {
      return page;
    }
    const firstOlderIndex = page.items.findIndex(
      (item) => Date.parse(item.createdAt) < restoredTime
    );
    const insertAt =
      firstOlderIndex === -1 ? page.items.length : firstOlderIndex;

    return {
      ...page,
      items: [
        ...page.items.slice(0, insertAt),
        chat,
        ...page.items.slice(insertAt),
      ],
    };
  });
};

/** The history of an account with no chats: one empty, last page. */
export const EMPTY_CHAT_HISTORY: ChatListDto[] = [
  { items: [], nextCursor: null },
];

/**
 * The cached votes with one message's vote set, or removed when `isUpvoted`
 * is `undefined`. A pure function of the current value, so applying the same
 * change twice is harmless. Nothing cached yet starts a list.
 */
export const withMessageVote = (
  current: ChatVotesDto | undefined,
  messageId: string,
  isUpvoted: boolean | undefined
): ChatVotesDto => {
  const others = (current?.items ?? []).filter(
    (vote) => vote.messageId !== messageId
  );

  return {
    ...current,
    items:
      isUpvoted === undefined ? others : [...others, { messageId, isUpvoted }],
  };
};
