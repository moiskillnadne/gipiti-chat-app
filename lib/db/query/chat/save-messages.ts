import { ChatSDKError } from "../../../errors";
import { db } from "../../connection";
import { type DBMessage, message } from "../../schema";

export async function saveMessages({ messages }: { messages: DBMessage[] }) {
  try {
    return await db.insert(message).values(messages).onConflictDoNothing();
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to save messages");
  }
}
