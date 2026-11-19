import { eq } from "drizzle-orm";
import { db } from "@/server/db/connection";
import { promptFavorite } from "@/server/db/schema";
import { ChatSDKError } from "../../../errors";

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
