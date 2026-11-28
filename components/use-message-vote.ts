"use client";

import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { getApiErrorMessageKey } from "@/client/shared/api/errors";
import { api } from "@/client/shared/api/orpc-client";
import { getChatVotesKey } from "@/client/shared/api/swr-keys";
import { useTranslations } from "@/lib/i18n/translate";
import { withMessageVote } from "./chat-history-cache";
import {
  settleVoteRequest,
  startVoteRequest,
  type VoteRecord,
} from "./vote-queue";

type CastVoteInput = {
  messageId: string;
  isUpvoted: boolean;
  /** What the message was voted before, to go back to when the call fails. */
  previousIsUpvoted: boolean | undefined;
};

/**
 * Votes on a message through v1. The votes cache of the chat is the one source
 * of truth: the vote shows at once, and the cache goes back to the earlier
 * vote (with a toast) when the server refuses.
 */
export const useMessageVote = (
  chatId: string
): ((input: CastVoteInput) => Promise<void>) => {
  const t = useTranslations("chat.messages");
  const tErrors = useTranslations("errors");
  const { mutate } = useSWRConfig();
  // Requests of one message go one after another, so two quick votes cannot
  // commit out of order on the server. The cache still changes at once. The
  // records say which vote the server holds, and how many requests are queued.
  const queues = useRef<Map<string, Promise<void>>>(new Map());
  const records = useRef<Map<string, VoteRecord>>(new Map());

  return useCallback(
    async ({
      messageId,
      isUpvoted,
      previousIsUpvoted,
    }: CastVoteInput): Promise<void> => {
      const votesKey = getChatVotesKey(chatId);
      const setCachedVote = (value: boolean | undefined) =>
        mutate(
          votesKey,
          (current: Parameters<typeof withMessageVote>[0]) =>
            withMessageVote(current, messageId, value),
          { revalidate: false }
        );
      const toastId = toast.loading(t(isUpvoted ? "upvoting" : "downvoting"));
      records.current.set(
        messageId,
        startVoteRequest(records.current.get(messageId), previousIsUpvoted)
      );
      await setCachedVote(isUpvoted);

      const settle = async (didSucceed: boolean): Promise<void> => {
        const record = records.current.get(messageId);
        if (!record) {
          return;
        }
        const settlement = settleVoteRequest(record, { isUpvoted, didSucceed });
        records.current.set(messageId, settlement.record);
        if (settlement.cacheWrite) {
          await setCachedVote(settlement.cacheWrite.isUpvoted);
        }
      };

      const sendVote = async (): Promise<void> => {
        let failure: unknown;
        let didSucceed = false;
        try {
          await api.chats.votes.set({ chatId, messageId, isUpvoted });
          didSucceed = true;
        } catch (error) {
          failure = error;
        }
        await settle(didSucceed);

        if (didSucceed) {
          toast.success(t(isUpvoted ? "upvoted" : "downvoted"), {
            id: toastId,
          });
          return;
        }
        const errorKey = getApiErrorMessageKey(failure);
        if (errorKey) {
          toast.error(t(isUpvoted ? "upvoteFailed" : "downvoteFailed"), {
            description: tErrors(errorKey),
            id: toastId,
          });
        } else {
          toast.dismiss(toastId);
        }
      };

      const earlierRequest = queues.current.get(messageId) ?? Promise.resolve();
      const thisRequest = earlierRequest.then(sendVote);
      queues.current.set(messageId, thisRequest);
      await thisRequest;
      if (queues.current.get(messageId) === thisRequest) {
        queues.current.delete(messageId);
        records.current.delete(messageId);
      }
    },
    [chatId, mutate, t, tErrors]
  );
};
