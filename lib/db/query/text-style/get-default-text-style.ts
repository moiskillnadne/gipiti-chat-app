import { and, eq } from "drizzle-orm";
import { ChatSDKError } from "../../../errors";
import { db } from "../../connection";
import { type TextStyle, textStyle } from "../../schema";

export async function getDefaultTextStyle({
  userId,
}: {
  userId: string;
}): Promise<TextStyle | undefined> {
  try {
    const [style] = await db
      .select()
      .from(textStyle)
      .where(and(eq(textStyle.userId, userId), eq(textStyle.isDefault, true)));
    return style;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to fetch default text style"
    );
  }
}
