import { and, eq } from "drizzle-orm";
import { ChatSDKError } from "../../../errors";
import { db } from "../../connection";
import { type TextStyle, textStyle } from "../../schema";

export async function updateTextStyle({
  id,
  userId,
  name,
  description,
  swatch,
  examples,
  isDefault,
  pinned,
}: {
  id: string;
  userId: string;
  name?: string;
  description?: string | null;
  swatch?: string | null;
  examples?: string[];
  isDefault?: boolean;
  pinned?: boolean;
}): Promise<TextStyle> {
  try {
    if (isDefault) {
      await db
        .update(textStyle)
        .set({ isDefault: false })
        .where(eq(textStyle.userId, userId));
    }

    const updates: Partial<{
      name: string;
      description: string | null;
      swatch: string | null;
      examples: string[];
      isDefault: boolean;
      pinned: boolean;
      updatedAt: Date;
    }> = { updatedAt: new Date() };

    if (name !== undefined) {
      updates.name = name;
    }
    if (description !== undefined) {
      updates.description = description;
    }
    if (swatch !== undefined) {
      updates.swatch = swatch;
    }
    if (examples !== undefined) {
      updates.examples = examples;
    }
    if (isDefault !== undefined) {
      updates.isDefault = isDefault;
    }
    if (pinned !== undefined) {
      updates.pinned = pinned;
    }

    const [updated] = await db
      .update(textStyle)
      .set(updates)
      .where(and(eq(textStyle.id, id), eq(textStyle.userId, userId)))
      .returning();
    return updated;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update text style"
    );
  }
}
