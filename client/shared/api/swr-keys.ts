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
