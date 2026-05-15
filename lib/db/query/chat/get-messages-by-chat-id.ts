import { asc, eq } from "drizzle-orm";
import { ChatSDKError } from "../../../errors";
import { db } from "../../connection";
import { message } from "../../schema";

export async function getMessagesByChatId({ id }: { id: string }) {
  try {
    return await db
      .select()
      .from(message)
      .where(eq(message.chatId, id))
      .orderBy(asc(message.createdAt));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get messages by chat id"
    );
  }
}
