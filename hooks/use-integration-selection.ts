"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  parseStoredSelection,
  selectionStorageKey,
} from "@/lib/integrations/ui";

/**
 * The integrations picked for one chat. Mirrors the selection in a ref so
 * `prepareSendMessagesRequest` never reads a stale closure, and persists it per
 * chat id in localStorage (which may be unavailable, so every access is guarded).
 */
export function useIntegrationSelection(chatId: string) {
  const [selectedIds, setSelectedIdsState] = useState<string[]>([]);
  const selectedIdsRef = useRef<string[]>([]);

  useEffect(() => {
    let stored: string[] = [];
    try {
      stored = parseStoredSelection(
        window.localStorage.getItem(selectionStorageKey(chatId))
      );
    } catch {
      // Storage blocked: start with nothing selected.
    }
    selectedIdsRef.current = stored;
    setSelectedIdsState(stored);
  }, [chatId]);

  const setSelectedIds = useCallback(
    (ids: string[]) => {
      selectedIdsRef.current = ids;
      setSelectedIdsState(ids);
      try {
        window.localStorage.setItem(
          selectionStorageKey(chatId),
          JSON.stringify(ids)
        );
      } catch {
        // Storage blocked: the selection still works for this page view.
      }
    },
    [chatId]
  );

  return { selectedIds, selectedIdsRef, setSelectedIds };
}

export type IntegrationSelection = ReturnType<typeof useIntegrationSelection>;
