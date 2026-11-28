import { and, eq } from "drizzle-orm";

import { type DatabaseExecutor, db } from "@/server/db/connection";
import { project } from "@/server/db/schema";

/**
 * Deletes the project of this user and returns whether there was one. The
 * rows of `ProjectFile` go with it through their foreign key (cascade), in the
 * same statement.
 */
export const deleteProjectOwnedByUser = async (
  { projectId, userId }: { projectId: string; userId: string },
  executor: DatabaseExecutor = db
): Promise<boolean> => {
  const deleted = await executor
    .delete(project)
    .where(and(eq(project.id, projectId), eq(project.userId, userId)))
    .returning({ id: project.id });

  return deleted.length > 0;
};
