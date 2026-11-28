import { and, eq } from "drizzle-orm";

import { type DatabaseExecutor, db } from "@/server/db/connection";
import { message } from "@/server/db/schema";

/** True when the message exists and belongs to that chat. */
export const isMessageInChat = async (
  { chatId, messageId }: { chatId: string; messageId: string },
  executor: DatabaseExecutor = db
): Promise<boolean> => {
  const [row] = await executor
    .select({ id: message.id })
    .from(message)
    .where(and(eq(message.id, messageId), eq(message.chatId, chatId)))
    .limit(1);

  return row !== undefined;
};
