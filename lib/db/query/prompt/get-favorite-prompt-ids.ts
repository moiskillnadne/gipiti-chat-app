import { eq } from "drizzle-orm";

import { ChatSDKError } from "../../../errors";
import { db } from "../../connection";
import { promptFavorite } from "../../schema";

export async function getFavoritePromptIds({
  userId,
}: {
  userId: string;
}): Promise<string[]> {
  try {
    const rows = await db
      .select({ promptId: promptFavorite.promptId })
      .from(promptFavorite)
      .where(eq(promptFavorite.userId, userId));

    return rows.map((row) => row.promptId);
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to fetch favorite prompts"
    );
  }
}
