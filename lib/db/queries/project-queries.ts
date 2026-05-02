/**
 * Project queries.
 * Handles CRUD for user-defined projects with context entries,
 * including default project selection per user.
 */
import { and, desc, eq, sql } from "drizzle-orm";

import { ChatSDKError } from "../../errors";
import {
  type Project,
  type ProjectFile,
  project,
  projectFile,
} from "../schema";
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
  description,
  swatch,
  contextEntries = [],
  isDefault = false,
}: {
  userId: string;
  name: string;
  description?: string | null;
  swatch?: string | null;
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
      .values({
        userId,
        name,
        description: description ?? null,
        swatch: swatch ?? null,
        contextEntries,
        isDefault,
      })
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

export async function incrementProjectUsage({
  id,
  userId,
}: {
  id: string;
  userId: string;
}): Promise<void> {
  try {
    await db
      .update(project)
      .set({ usageCount: sql`${project.usageCount} + 1` })
      .where(and(eq(project.id, id), eq(project.userId, userId)));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to increment project usage"
    );
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

export async function getProjectFiles({
  projectId,
  userId,
}: {
  projectId: string;
  userId: string;
}): Promise<ProjectFile[]> {
  try {
    return await db
      .select()
      .from(projectFile)
      .where(
        and(
          eq(projectFile.projectId, projectId),
          eq(projectFile.userId, userId)
        )
      )
      .orderBy(desc(projectFile.createdAt));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to fetch project files"
    );
  }
}

export async function getProjectFileById({
  id,
}: {
  id: string;
}): Promise<ProjectFile | undefined> {
  try {
    const [found] = await db
      .select()
      .from(projectFile)
      .where(eq(projectFile.id, id));
    return found;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to fetch project file"
    );
  }
}

export async function createProjectFile({
  projectId,
  userId,
  name,
  size,
  mimeType,
  blobUrl,
  pathname,
}: {
  projectId: string;
  userId: string;
  name: string;
  size: number;
  mimeType: string;
  blobUrl: string;
  pathname: string;
}): Promise<ProjectFile> {
  try {
    const [created] = await db
      .insert(projectFile)
      .values({ projectId, userId, name, size, mimeType, blobUrl, pathname })
      .returning();
    return created;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to create project file"
    );
  }
}

export async function deleteProjectFileRecord({
  id,
  userId,
}: {
  id: string;
  userId: string;
}): Promise<void> {
  try {
    await db
      .delete(projectFile)
      .where(and(eq(projectFile.id, id), eq(projectFile.userId, userId)));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete project file"
    );
  }
}
