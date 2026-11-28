import type { FavoritePromptsDto } from "@/client/shared/api/types";

/**
 * The cached favourites with one prompt added or removed. A pure function of
 * the current value, so toggles of different prompts compose and applying the
 * same change twice is harmless. Nothing cached yet stays nothing.
 */
export const withFavorite = (
  current: FavoritePromptsDto | undefined,
  promptId: string,
  shouldFavorite: boolean
): FavoritePromptsDto | undefined => {
  if (!current) {
    return current;
  }
  const others = current.items.filter((item) => item.promptId !== promptId);

  return {
    ...current,
    items: shouldFavorite ? [...others, { promptId }] : others,
  };
};

/**
 * A failed read is an error to show only when there is nothing to show: SWR
 * keeps the last good data when a revalidation fails.
 */
export const getVisibleLoadError = (error: unknown, data: unknown): unknown =>
  data === undefined ? error : undefined;
