import { eq } from "drizzle-orm";
import { ChatSDKError } from "../../../errors";
import { db } from "../../queries";
import { type TextStyle, textStyle } from "../../schema";

export async function createTextStyle({
  userId,
  name,
  description,
  swatch,
  examples = [],
  isDefault = false,
}: {
  userId: string;
  name: string;
  description?: string | null;
  swatch?: string | null;
  examples?: string[];
  isDefault?: boolean;
}): Promise<TextStyle> {
  try {
    if (isDefault) {
      await db
        .update(textStyle)
        .set({ isDefault: false })
        .where(eq(textStyle.userId, userId));
    }

    const [created] = await db
      .insert(textStyle)
      .values({
        userId,
        name,
        description: description ?? null,
        swatch: swatch ?? null,
        examples,
        isDefault,
      })
      .returning();
    return created;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to create text style"
    );
  }
}
