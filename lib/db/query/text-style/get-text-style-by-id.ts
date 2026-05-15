import { eq } from "drizzle-orm";
import { ChatSDKError } from "../../../errors";
import { db } from "../../connection";
import { type TextStyle, textStyle } from "../../schema";

export async function getTextStyleById({
  id,
}: {
  id: string;
}): Promise<TextStyle | undefined> {
  try {
    const [style] = await db
      .select()
      .from(textStyle)
      .where(eq(textStyle.id, id));
    return style;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to fetch text style"
    );
  }
}
