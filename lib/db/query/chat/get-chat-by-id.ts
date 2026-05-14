import { eq } from "drizzle-orm";
import { ChatSDKError } from "../../../errors";
import { db } from "../../queries";
import { chat } from "../../schema";

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
