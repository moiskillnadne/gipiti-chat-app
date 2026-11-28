"use client";

import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import useSWRInfinite from "swr/infinite";
import {
  getApiErrorCode,
  getApiErrorMessageKey,
} from "@/client/shared/api/errors";
import { api } from "@/client/shared/api/orpc-client";
import {
  type ChatHistoryKey,
  getChatHistoryKey,
} from "@/client/shared/api/swr-keys";
import type { ChatListDto } from "@/client/shared/api/types";
import { useTranslations } from "@/lib/i18n/translate";
import { findChat, withChatRestored, withoutChat } from "./chat-history-cache";

type ChatHistory = {
  pages: ChatListDto[];
  /** Set only when a read failed and there is no chat to show instead. */
  loadError: unknown;
  isLoading: boolean;
  isValidating: boolean;
  hasReachedEnd: boolean;
  loadMore: () => void;
  deleteChat: (chatId: string) => Promise<void>;
};

const NOT_FOUND_CODE = "NOT_FOUND";

const fetchChatPage = ([
  ,
  ,
  limit,
  cursor,
]: ChatHistoryKey): Promise<ChatListDto> =>
  api.chats.list({ limit, cursor: cursor ?? undefined });

/**
 * Reads the sidebar history from v1, page by page, and owns deleting one chat.
 * The cached pages are the one source of truth: a deleted chat leaves them at
 * once and comes back, with a toast, when the server refuses.
 */
export const useChatHistory = (): ChatHistory => {
  const t = useTranslations("chat.sidebar");
  const tErrors = useTranslations("errors");
  const {
    data,
    error: readError,
    size: requestedSize,
    setSize,
    isValidating,
    isLoading,
    mutate,
  } = useSWRInfinite(getChatHistoryKey, fetchChatPage, { fallbackData: [] });
  // A second delete of a chat whose request is in flight is ignored.
  const inFlightIds = useRef<Set<string>>(new Set());
  const pages = data ?? [];

  const hasReachedEnd = pages.some((page) => page.nextCursor === null);

  const hasNoChats = pages.every((page) => page.items.length === 0);

  // The sentinel loads a page only when it comes into view. If every loaded
  // chat is gone and older pages remain, it may already be in view, so ask
  // for the next page here. It fires again only once the requested page has
  // arrived (`size` equals the pages held), and stops at the last page.
  useEffect(() => {
    const isNextPageNeeded =
      pages.length > 0 &&
      hasNoChats &&
      !hasReachedEnd &&
      !isValidating &&
      !readError &&
      requestedSize <= pages.length;
    if (isNextPageNeeded) {
      setSize(pages.length + 1);
    }
  }, [
    hasNoChats,
    hasReachedEnd,
    isValidating,
    pages.length,
    readError,
    requestedSize,
    setSize,
  ]);

  const loadMore = useCallback(() => {
    if (!(isValidating || hasReachedEnd)) {
      setSize((current) => current + 1);
    }
  }, [hasReachedEnd, isValidating, setSize]);

  const deleteChat = useCallback(
    async (chatId: string): Promise<void> => {
      if (inFlightIds.current.has(chatId)) {
        return;
      }
      inFlightIds.current.add(chatId);
      const removedChat = findChat(data, chatId);
      const toastId = toast.loading(t("deletingChat"));
      await mutate((current) => withoutChat(current, chatId), {
        revalidate: false,
      });

      try {
        await api.chats.remove({ chatId });
        // Idempotent: removes the chat again if a revalidation that began
        // before the server committed has brought it back.
        await mutate((current) => withoutChat(current, chatId), {
          revalidate: false,
        });
        toast.success(t("deleteChatSuccess"), { id: toastId });
      } catch (error) {
        // 404 means the chat is already gone, which is what was asked for.
        if (getApiErrorCode(error) === NOT_FOUND_CODE) {
          await mutate((current) => withoutChat(current, chatId), {
            revalidate: false,
          });
          toast.success(t("deleteChatSuccess"), { id: toastId });
          return;
        }
        if (removedChat) {
          await mutate((current) => withChatRestored(current, removedChat), {
            revalidate: false,
          });
        }
        const errorKey = getApiErrorMessageKey(error);
        if (errorKey) {
          toast.error(t("deleteChatError"), {
            description: tErrors(errorKey),
            id: toastId,
          });
        } else {
          toast.dismiss(toastId);
        }
        // Catch up with whatever the server really holds.
        await mutate();
      } finally {
        inFlightIds.current.delete(chatId);
      }
    },
    [data, mutate, t, tErrors]
  );

  return {
    pages,
    loadError: hasNoChats ? readError : undefined,
    isLoading,
    isValidating,
    hasReachedEnd,
    loadMore,
    deleteChat,
  };
};
