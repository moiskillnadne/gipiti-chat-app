import { and, eq } from "drizzle-orm";

import { type DatabaseExecutor, db } from "@/server/db/connection";
import { type Project, project } from "@/server/db/schema";

/** The fields a caller may change. A key that is absent is left alone. */
export type ProjectChanges = {
  name?: string;
  description?: string | null;
  swatch?: string | null;
  contextEntries?: string[];
  isDefault?: boolean;
  pinned?: boolean;
};

/**
 * Writes the changes and sets `updatedAt`, only on a project of this user.
 * `null` when there is no such project; nothing is written then.
 */
export const updateProjectOwnedByUser = async (
  {
    projectId,
    userId,
    changes,
  }: { projectId: string; userId: string; changes: ProjectChanges },
  executor: DatabaseExecutor = db
): Promise<Project | null> => {
  const [updated] = await executor
    .update(project)
    .set({ ...changes, updatedAt: new Date() })
    .where(and(eq(project.id, projectId), eq(project.userId, userId)))
    .returning();

  return updated ?? null;
};
