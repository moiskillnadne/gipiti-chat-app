import type { ChatDto } from "@/server/api/v1/_schemas/chat";

type ChatSummary = { id: string; title: string; createdAt: Date };

/** Leaves out the owner and the last context, which clients do not see. */
export const toChatDto = (row: ChatSummary): ChatDto => ({
  id: row.id,
  title: row.title,
  createdAt: row.createdAt.toISOString(),
});
