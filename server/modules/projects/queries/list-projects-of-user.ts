import { asc, desc, eq } from "drizzle-orm";

import { type DatabaseExecutor, db } from "@/server/db/connection";
import { type Project, project } from "@/server/db/schema";

/** Most recently changed first, as the legacy list; the id breaks ties. */
export const listProjectsOfUser = async (
  { userId }: { userId: string },
  executor: DatabaseExecutor = db
): Promise<Project[]> =>
  await executor
    .select()
    .from(project)
    .where(eq(project.userId, userId))
    .orderBy(desc(project.updatedAt), asc(project.id));
