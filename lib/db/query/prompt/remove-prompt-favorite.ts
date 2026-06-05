import { and, eq } from "drizzle-orm";

import { ChatSDKError } from "../../../errors";
import { db } from "../../connection";
import { promptFavorite } from "../../schema";

export async function removePromptFavorite({
  userId,
  promptId,
}: {
  userId: string;
  promptId: string;
}): Promise<void> {
  try {
    await db
      .delete(promptFavorite)
      .where(
        and(
          eq(promptFavorite.userId, userId),
          eq(promptFavorite.promptId, promptId)
        )
      );
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to remove favorite prompt"
    );
  }
}
