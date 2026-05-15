import { eq } from "drizzle-orm";
import { db } from "../../connection";
import { chat } from "../../schema";

export async function updateChatTitle({
  chatId,
  title,
}: {
  chatId: string;
  title: string;
}) {
  try {
    return await db.update(chat).set({ title }).where(eq(chat.id, chatId));
  } catch (error) {
    console.warn("Failed to update chat title", chatId, error);
  }
}
