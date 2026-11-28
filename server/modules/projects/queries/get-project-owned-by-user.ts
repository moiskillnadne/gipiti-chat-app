import { and, eq } from "drizzle-orm";

import { type DatabaseExecutor, db } from "@/server/db/connection";
import { type Project, project } from "@/server/db/schema";

/**
 * The project, only when it belongs to the user: a missing project and
 * another user's project are both `null`.
 */
export const getProjectOwnedByUser = async (
  { projectId, userId }: { projectId: string; userId: string },
  executor: DatabaseExecutor = db
): Promise<Project | null> => {
  const [row] = await executor
    .select()
    .from(project)
    .where(and(eq(project.id, projectId), eq(project.userId, userId)))
    .limit(1);

  return row ?? null;
};
