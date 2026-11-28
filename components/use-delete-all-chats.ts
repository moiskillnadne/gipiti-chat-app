"use client";

import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
import { getApiErrorMessageKey } from "@/client/shared/api/errors";
import { api } from "@/client/shared/api/orpc-client";
import { getChatHistoryKey } from "@/client/shared/api/swr-keys";
import { useTranslations } from "@/lib/i18n/translate";
import { EMPTY_CHAT_HISTORY } from "./chat-history-cache";

/**
 * Deletes every chat of the user through v1. Resolves to `true` when the chats
 * are gone, so the caller can leave the open chat.
 */
export const useDeleteAllChats = (): (() => Promise<boolean>) => {
  const t = useTranslations("chat.sidebar");
  const tErrors = useTranslations("errors");
  const { mutate } = useSWRConfig();
  const isRunning = useRef(false);

  return useCallback(async (): Promise<boolean> => {
    if (isRunning.current) {
      return false;
    }
    isRunning.current = true;
    const toastId = toast.loading(t("deletingAllChats"));

    try {
      await api.chats.removeAll({ query: { confirm: "true" } });
      await mutate(unstable_serialize(getChatHistoryKey), EMPTY_CHAT_HISTORY, {
        revalidate: false,
      });
      toast.success(t("deleteAllSuccess"), { id: toastId });
      return true;
    } catch (error) {
      const errorKey = getApiErrorMessageKey(error);
      if (errorKey) {
        toast.error(t("deleteAllError"), {
          description: tErrors(errorKey),
          id: toastId,
        });
      } else {
        toast.dismiss(toastId);
      }
      // Some chats may be gone even though the call failed: catch up.
      await mutate(unstable_serialize(getChatHistoryKey));
      return false;
    } finally {
      isRunning.current = false;
    }
  }, [mutate, t, tErrors]);
};
