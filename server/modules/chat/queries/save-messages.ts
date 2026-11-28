import { ChatSDKError } from "@/lib/errors";
import { db } from "@/server/db/connection";
import { type DBMessage, message } from "@/server/db/schema";

export async function saveMessages({ messages }: { messages: DBMessage[] }) {
  try {
    return await db.insert(message).values(messages).onConflictDoNothing();
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to save messages");
  }
}
