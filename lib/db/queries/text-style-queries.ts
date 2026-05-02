/**
 * Text style queries.
 * Handles CRUD for user-defined writing styles with example texts,
 * including default style selection per user.
 */
import { and, desc, eq, sql } from "drizzle-orm";

import { ChatSDKError } from "../../errors";
import { type TextStyle, textStyle } from "../schema";
import { db } from "./connection";

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
