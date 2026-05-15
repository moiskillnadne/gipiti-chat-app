import { and, eq } from "drizzle-orm";

import { ChatSDKError } from "../../../errors";
import { db } from "../../connection";
import { type Project, project } from "../../schema";

export async function updateProject({
  id,
  userId,
  name,
  description,
  swatch,
  contextEntries,
  isDefault,
  pinned,
}: {
  id: string;
  userId: string;
  name?: string;
  description?: string | null;
  swatch?: string | null;
  contextEntries?: string[];
  isDefault?: boolean;
  pinned?: boolean;
}): Promise<Project> {
  try {
    if (isDefault) {
      await db
        .update(project)
        .set({ isDefault: false })
        .where(eq(project.userId, userId));
    }

    const updates: Partial<{
      name: string;
      description: string | null;
      swatch: string | null;
      contextEntries: string[];
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
    if (contextEntries !== undefined) {
      updates.contextEntries = contextEntries;
    }
    if (isDefault !== undefined) {
      updates.isDefault = isDefault;
    }
    if (pinned !== undefined) {
      updates.pinned = pinned;
    }

    const [updated] = await db
      .update(project)
      .set(updates)
      .where(and(eq(project.id, id), eq(project.userId, userId)))
      .returning();
    return updated;
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to update project");
  }
}
