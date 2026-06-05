import { ChatSDKError } from "../../../errors";
import { db } from "../../connection";
import { promptFavorite } from "../../schema";

export async function addPromptFavorite({
  userId,
  promptId,
}: {
  userId: string;
  promptId: string;
}): Promise<void> {
  try {
    await db
      .insert(promptFavorite)
      .values({ userId, promptId })
      .onConflictDoNothing();
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to add favorite prompt"
    );
  }
}
