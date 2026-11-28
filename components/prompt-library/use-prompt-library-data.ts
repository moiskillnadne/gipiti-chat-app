"use client";

import { useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { api } from "@/client/shared/api/orpc-client";
import {
  FAVORITE_PROMPTS_SWR_KEY,
  PROMPTS_SWR_KEY,
} from "@/client/shared/api/swr-keys";
import type { PromptDto } from "@/client/shared/api/types";
import { useTranslations } from "@/lib/i18n/translate";
import { getVisibleLoadError, withFavorite } from "./favorite-cache";

type PromptLibraryData = {
  prompts: PromptDto[];
  favoriteIds: Set<string>;
  isLoading: boolean;
  /** Set only when a read failed and there is nothing to show instead. */
  loadError: unknown;
  toggleFavorite: (promptId: string) => Promise<void>;
};

// A stable empty list, so memos that depend on `prompts` do not rerun while loading.
const NO_PROMPTS: PromptDto[] = [];

/**
 * Reads the catalogue and the user's favourites from v1 and owns the optimistic
 * star toggle. The favourites cache is the one source of truth: the star flips
 * by writing to it, and flips back (with a toast) when the request fails.
 * The page is signed-in only (`app/(chat)/prompts/page.tsx` redirects others),
 * so the favourites call needs no anonymous branch.
 */
export const usePromptLibraryData = (): PromptLibraryData => {
  const t = useTranslations("promptLibrary");
  const promptsRequest = useSWR(PROMPTS_SWR_KEY, () => api.prompts.list());
  const favoritesRequest = useSWR(FAVORITE_PROMPTS_SWR_KEY, () =>
    api.me.favoritePrompts.list()
  );
  const { mutate: mutateFavorites } = favoritesRequest;
  // A second click on a prompt whose request is in flight is ignored: the
  // add and the remove could commit out of order on the server.
  const inFlightIds = useRef<Set<string>>(new Set());

  const favoriteIds = useMemo(
    () =>
      new Set(favoritesRequest.data?.items.map((item) => item.promptId) ?? []),
    [favoritesRequest.data]
  );

  const setCachedFavorite = useCallback(
    (promptId: string, shouldFavorite: boolean) =>
      mutateFavorites(
        (current) => withFavorite(current, promptId, shouldFavorite),
        { revalidate: false }
      ),
    [mutateFavorites]
  );

  const toggleFavorite = useCallback(
    async (promptId: string): Promise<void> => {
      if (inFlightIds.current.has(promptId)) {
        return;
      }
      inFlightIds.current.add(promptId);
      const shouldFavorite = !favoriteIds.has(promptId);
      await setCachedFavorite(promptId, shouldFavorite);

      try {
        if (shouldFavorite) {
          await api.me.favoritePrompts.add({ promptId });
        } else {
          await api.me.favoritePrompts.remove({ promptId });
        }
        // Idempotent: restores the star if a revalidation that began before
        // the server committed has overwritten the optimistic change.
        await setCachedFavorite(promptId, shouldFavorite);
      } catch {
        await setCachedFavorite(promptId, !shouldFavorite);
        toast.error(t("favoriteError"));
        // Catch up with whatever the server really holds.
        await mutateFavorites();
      } finally {
        inFlightIds.current.delete(promptId);
      }
    },
    [favoriteIds, mutateFavorites, setCachedFavorite, t]
  );

  return {
    prompts: promptsRequest.data?.items ?? NO_PROMPTS,
    favoriteIds,
    // Wait for both reads so the stars do not pop in after the cards.
    isLoading: promptsRequest.isLoading || favoritesRequest.isLoading,
    loadError:
      getVisibleLoadError(promptsRequest.error, promptsRequest.data) ??
      getVisibleLoadError(favoritesRequest.error, favoritesRequest.data),
    toggleFavorite,
  };
};
