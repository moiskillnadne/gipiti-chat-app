import { and, eq } from "drizzle-orm";
import { ChatSDKError } from "../../../errors";
import { db } from "../../connection";
import { textStyle } from "../../schema";

export async function deleteTextStyle({
  id,
  userId,
}: {
  id: string;
  userId: string;
}): Promise<void> {
  try {
    await db
      .delete(textStyle)
      .where(and(eq(textStyle.id, id), eq(textStyle.userId, userId)));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete text style"
    );
  }
}
