import { asc, eq, sql } from "drizzle-orm";

import type { DatabaseExecutor } from "@/server/db/connection";
import { project } from "@/server/db/schema";

/**
 * Serialises everything that changes which project of a user is the default.
 * Locking the user's project rows is not enough on its own: a user with no
 * project yet has no rows to lock, so two first projects made at once would
 * both be defaults. The advisory lock is released when the transaction ends.
 *
 * Returns how many projects the user has, which is exact once the locks are
 * held.
 *
 * Call it first inside a transaction, then take the row locks, so every
 * caller takes them in the same order (the id order below) and none waits
 * for another in a cycle.
 */
export const lockProjectsOfUser = async (
  { userId }: { userId: string },
  executor: DatabaseExecutor
): Promise<number> => {
  await executor.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${`project-default:${userId}`}, 0))`
  );
  const locked = await executor
    .select({ id: project.id })
    .from(project)
    .where(eq(project.userId, userId))
    .orderBy(asc(project.id))
    .for("update");

  return locked.length;
};
