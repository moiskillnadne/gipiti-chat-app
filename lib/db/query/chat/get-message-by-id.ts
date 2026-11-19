import { eq } from "drizzle-orm";
import { db } from "@/server/db/connection";
import { message } from "@/server/db/schema";
import { ChatSDKError } from "../../../errors";

export async function getMessageById({ id }: { id: string }) {
  try {
    return await db.select().from(message).where(eq(message.id, id));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get message by id"
    );
  }
}
