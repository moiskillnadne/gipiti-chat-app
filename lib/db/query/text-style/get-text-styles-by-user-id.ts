import { desc, eq } from "drizzle-orm";
import { ChatSDKError } from "../../../errors";
import { db } from "../../connection";
import { type TextStyle, textStyle } from "../../schema";

export async function getTextStylesByUserId({
  userId,
}: {
  userId: string;
}): Promise<TextStyle[]> {
  try {
    return await db
      .select()
      .from(textStyle)
      .where(eq(textStyle.userId, userId))
      .orderBy(desc(textStyle.updatedAt));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to fetch text styles"
    );
  }
}
