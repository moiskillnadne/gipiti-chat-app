import { and, eq } from "drizzle-orm";

import type { DatabaseExecutor } from "@/server/db/connection";
import { project } from "@/server/db/schema";

/** Clears the default flag on the user's projects; `updatedAt` is not touched. */
export const clearDefaultProjects = async (
  { userId }: { userId: string },
  executor: DatabaseExecutor
): Promise<void> => {
  await executor
    .update(project)
    .set({ isDefault: false })
    .where(and(eq(project.userId, userId), eq(project.isDefault, true)));
};
