import { eq } from "drizzle-orm";
import { db } from "@/server/db/connection";
import { chat } from "@/server/db/schema";
import { ChatSDKError } from "../../../errors";

export async function getChatById({ id }: { id: string }) {
  try {
    const [selectedChat] = await db.select().from(chat).where(eq(chat.id, id));
    if (!selectedChat) {
      return null;
    }

    return selectedChat;
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to get chat by id");
  }
}
