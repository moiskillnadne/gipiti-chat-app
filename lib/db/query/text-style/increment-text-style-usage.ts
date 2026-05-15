import { and, eq, sql } from "drizzle-orm";
import { ChatSDKError } from "../../../errors";
import { db } from "../../queries";
import { textStyle } from "../../schema";

export async function incrementTextStyleUsage({
  id,
  userId,
}: {
  id: string;
  userId: string;
}): Promise<void> {
  try {
    await db
      .update(textStyle)
      .set({ usageCount: sql`${textStyle.usageCount} + 1` })
      .where(and(eq(textStyle.id, id), eq(textStyle.userId, userId)));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to increment text style usage"
    );
  }
}
