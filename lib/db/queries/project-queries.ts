/**
 * Project queries.
 * Handles CRUD for user-defined projects with context entries,
 * including default project selection per user.
 */
import { and, desc, eq } from "drizzle-orm";

import { ChatSDKError } from "../../errors";
import { type Project, project } from "../schema";
import { db } from "./connection";

export async function getProjectsByUserId({
  userId,
}: {
  userId: string;
}): Promise<Project[]> {
  try {
    return await db
      .select()
      .from(project)
      .where(eq(project.userId, userId))
      .orderBy(desc(project.updatedAt));
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to fetch projects");
  }
}

export async function getProjectById({
  id,
}: {
  id: string;
}): Promise<Project | undefined> {
  try {
    const [found] = await db.select().from(project).where(eq(project.id, id));
    return found;
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to fetch project");
  }
}

export async function createProject({
  userId,
  name,
  contextEntries = [],
  isDefault = false,
}: {
  userId: string;
  name: string;
  contextEntries?: string[];
  isDefault?: boolean;
}): Promise<Project> {
  try {
    if (isDefault) {
      await db
        .update(project)
        .set({ isDefault: false })
        .where(eq(project.userId, userId));
    }

    const [created] = await db
      .insert(project)
      .values({ userId, name, contextEntries, isDefault })
      .returning();
    return created;
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to create project");
  }
}

export async function updateProject({
  id,
  userId,
  name,
  contextEntries,
  isDefault,
}: {
  id: string;
  userId: string;
  name?: string;
  contextEntries?: string[];
  isDefault?: boolean;
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
      contextEntries: string[];
      isDefault: boolean;
      updatedAt: Date;
    }> = { updatedAt: new Date() };

    if (name !== undefined) {
      updates.name = name;
    }
    if (contextEntries !== undefined) {
      updates.contextEntries = contextEntries;
    }
    if (isDefault !== undefined) {
      updates.isDefault = isDefault;
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

export async function deleteProject({
  id,
  userId,
}: {
  id: string;
  userId: string;
}): Promise<void> {
  try {
    await db
      .delete(project)
      .where(and(eq(project.id, id), eq(project.userId, userId)));
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to delete project");
  }
}

export async function getDefaultProject({
  userId,
}: {
  userId: string;
}): Promise<Project | undefined> {
  try {
    const [found] = await db
      .select()
      .from(project)
      .where(and(eq(project.userId, userId), eq(project.isDefault, true)));
    return found;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to fetch default project"
    );
  }
}
