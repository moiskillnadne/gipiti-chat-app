import { eq } from "drizzle-orm";
import { db } from "@/server/db/connection";
import { chat } from "@/server/db/schema";

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
