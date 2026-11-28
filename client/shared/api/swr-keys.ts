/**
 * SWR cache keys of the v1 reads, in one place so that code which changes
 * the data can revalidate them with `mutate(KEY)`.
 */
export const PROMPTS_SWR_KEY = ["v1", "prompts"] as const;
export const FAVORITE_PROMPTS_SWR_KEY = [
  "v1",
  "me",
  "favorite-prompts",
] as const;

/** How many chats one page of the sidebar history holds. */
export const CHAT_HISTORY_PAGE_SIZE = 20;

/** The key of one page of the history; `cursor` is `null` for the first. */
export type ChatHistoryKey = readonly [
  "v1",
  "chats",
  typeof CHAT_HISTORY_PAGE_SIZE,
  string | null,
];

/**
 * The page-key loader of the sidebar history (`useSWRInfinite`). It is also
 * what code outside the sidebar passes to `unstable_serialize` to revalidate
 * or rewrite the whole list, so there is exactly one of it.
 */
export const getChatHistoryKey = (
  pageIndex: number,
  previousPage: { nextCursor: string | null } | null
): ChatHistoryKey | null => {
  if (pageIndex === 0) {
    return ["v1", "chats", CHAT_HISTORY_PAGE_SIZE, null];
  }
  if (!previousPage || previousPage.nextCursor === null) {
    return null;
  }

  return ["v1", "chats", CHAT_HISTORY_PAGE_SIZE, previousPage.nextCursor];
};

/**
 * The votes of a chat. The caller passes `null` instead of this key while the
 * chat has fewer than two messages.
 */
export const getChatVotesKey = (
  chatId: string
): readonly ["v1", "chats", string, "votes"] => [
  "v1",
  "chats",
  chatId,
  "votes",
];
