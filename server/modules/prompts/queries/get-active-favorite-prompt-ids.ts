import { and, eq } from "drizzle-orm";
import { ChatSDKError } from "@/lib/errors";
import { db } from "@/server/db/connection";
import { prompt, promptFavorite } from "@/server/db/schema";

/**
 * The ids of the user's favourites that are on offer now (their prompt is
 * active). A favourite of a switched-off prompt stays stored and is listed
 * again when the prompt is switched back on.
 */
export async function getActiveFavoritePromptIds({
  userId,
}: {
  userId: string;
}): Promise<string[]> {
  try {
    const rows = await db
      .select({ promptId: promptFavorite.promptId })
      .from(promptFavorite)
      .innerJoin(prompt, eq(prompt.id, promptFavorite.promptId))
      .where(and(eq(promptFavorite.userId, userId), eq(prompt.isActive, true)));

    return rows.map((row) => row.promptId);
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to fetch favorite prompts"
    );
  }
}
