import { and, desc, eq } from "drizzle-orm";
import { ChatSDKError } from "../../../errors";
import { db } from "../../connection";
import { message } from "../../schema";

/** The chat's most recent user message (id + createdAt), or undefined. */
export async function getLatestUserMessageByChatId({
  chatId,
}: {
  chatId: string;
}) {
  try {
    const [latest] = await db
      .select({ id: message.id, createdAt: message.createdAt })
      .from(message)
      .where(and(eq(message.chatId, chatId), eq(message.role, "user")))
      .orderBy(desc(message.createdAt))
      .limit(1);
    return latest;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get latest user message"
    );
  }
}
