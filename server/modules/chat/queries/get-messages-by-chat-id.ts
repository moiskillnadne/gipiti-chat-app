import { asc, eq } from "drizzle-orm";
import { ChatSDKError } from "@/lib/errors";
import { db } from "@/server/db/connection";
import { message } from "@/server/db/schema";

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
