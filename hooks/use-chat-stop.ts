"use client";

import { useCallback, useEffect, useRef } from "react";
import type { ChatMessage } from "@/lib/types";
import { fetchWithErrorHandlers } from "@/lib/utils";

// Upper bound for waiting on an in-flight stop request before the next send.
const PENDING_STOP_TIMEOUT_MS = 3000;

type FetchFn = typeof fetchWithErrorHandlers;

type UseChatStopOptions = {
  chatId: string;
  stop: () => Promise<void>;
  /**
   * Current messages of the chat. The stop names the turn by its last user
   * message, the one the server was sent with the turn.
   */
  getMessages: () => ChatMessage[];
};

const resolveMethod = (input: RequestInfo | URL, init?: RequestInit): string =>
  (
    init?.method ?? (input instanceof Request ? input.method : "GET")
  ).toUpperCase();

/**
 * Stop handling for text answers.
 *
 * `useChat().stop()` only aborts the POST fetch. A resumed stream (GET
 * reconnect) is fetched without a signal and keeps going, and the server
 * producer is not told to abort. This hook:
 *  - tells the server to abort the turn (`POST /api/chat/:id/stop`) and names
 *    the turn by the id of the last user message in `messages`. The chat POST
 *    carries `messages.at(-1)` (a user message) both for a new message and for
 *    regenerate/edit, and a resumed stream belongs to the last user message of
 *    the history, so client and server always agree on this id,
 *  - stops the client,
 *  - aborts the resumed read through a controller injected by the fetch wrapper.
 */
export function useChatStop({ chatId, stop, getMessages }: UseChatStopOptions) {
  const chatIdRef = useRef(chatId);
  const stopRef = useRef(stop);
  const getMessagesRef = useRef(getMessages);
  const pendingStopRef = useRef<Promise<unknown> | null>(null);
  const resumeControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    chatIdRef.current = chatId;
    stopRef.current = stop;
    getMessagesRef.current = getMessages;
  }, [chatId, stop, getMessages]);

  const handleStop = useCallback(() => {
    const messageId = getMessagesRef
      .current()
      .findLast((message) => message.role === "user")?.id;

    if (messageId) {
      const request: Promise<unknown> = fetch(
        `/api/chat/${chatIdRef.current}/stop`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageId }),
          keepalive: true,
        }
      )
        .catch(() => {
          // Best effort: the client has stopped regardless of the server reply.
        })
        .finally(() => {
          if (pendingStopRef.current === request) {
            pendingStopRef.current = null;
          }
        });
      pendingStopRef.current = request;
    }

    stopRef.current().catch(() => {
      // stop() only aborts local fetches; nothing to recover from.
    });

    resumeControllerRef.current?.abort();
    resumeControllerRef.current = null;
  }, []);

  const waitForPendingStop = useCallback(async () => {
    const pending = pendingStopRef.current;
    if (!pending) {
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, PENDING_STOP_TIMEOUT_MS);
    });
    await Promise.race([pending, timeout]);
    clearTimeout(timer);
  }, []);

  // A GET without a signal is the SDK's stream reconnect: give it one so
  // that `handleStop` can break the read.
  const fetchWithResumeAbort = useCallback<FetchFn>((input, init) => {
    if (resolveMethod(input, init) !== "GET" || init?.signal) {
      return fetchWithErrorHandlers(input, init);
    }
    const controller = new AbortController();
    resumeControllerRef.current = controller;
    return fetchWithErrorHandlers(input, {
      ...init,
      signal: controller.signal,
    });
  }, []);

  return { handleStop, waitForPendingStop, fetchWithResumeAbort };
}
