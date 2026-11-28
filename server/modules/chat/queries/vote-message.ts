import { ChatSDKError } from "@/lib/errors";
import { type DatabaseExecutor, db } from "@/server/db/connection";
import { vote } from "@/server/db/schema";

export async function voteMessage(
  {
    chatId,
    messageId,
    type,
  }: {
    chatId: string;
    messageId: string;
    type: "up" | "down";
  },
  executor: DatabaseExecutor = db
) {
  const isUpvoted = type === "up";

  try {
    // Upsert on the primary key (chatId, messageId): one statement, and a vote
    // row of another chat is never matched by its messageId alone.
    return await executor
      .insert(vote)
      .values({ chatId, messageId, isUpvoted })
      .onConflictDoUpdate({
        target: [vote.chatId, vote.messageId],
        set: { isUpvoted },
      });
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to vote message");
  }
}
