import { eq } from "drizzle-orm";
import { db } from "@/server/db/connection";
import { vote } from "@/server/db/schema";
import { ChatSDKError } from "../../../errors";

export async function getVotesByChatId({ id }: { id: string }) {
  try {
    return await db.select().from(vote).where(eq(vote.chatId, id));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get votes by chat id"
    );
  }
}
