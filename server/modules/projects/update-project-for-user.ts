import { db } from "@/server/db/connection";
import type { Project } from "@/server/db/schema";
import { clearDefaultProjects } from "@/server/modules/projects/queries/clear-default-projects";
import { getProjectOwnedByUser } from "@/server/modules/projects/queries/get-project-owned-by-user";
import { lockProjectsOfUser } from "@/server/modules/projects/queries/lock-projects-of-user";
import {
  type ProjectChanges,
  updateProjectOwnedByUser,
} from "@/server/modules/projects/queries/update-project-owned-by-user";

export type UpdateProjectResult =
  | { status: "ok"; project: Project }
  /** No such project, or it is another user's: nothing was changed. */
  | { status: "project_not_found" };

const notFound: UpdateProjectResult = { status: "project_not_found" };

const hasChanges = (changes: ProjectChanges): boolean =>
  Object.values(changes).some((value) => value !== undefined);

/** Only the keys that are set; an `undefined` would be written as a reset. */
const definedChanges = (changes: ProjectChanges): ProjectChanges =>
  Object.fromEntries(
    Object.entries(changes).filter(([, value]) => value !== undefined)
  );

/**
 * Changes a project of the user.
 *
 * - No change at all: the project is returned as it is and `updatedAt` is
 *   not touched (the legacy route bumps it).
 * - `isDefault: true`: one transaction takes the user's default lock, checks
 *   that the project is the user's, clears the other defaults and writes. A
 *   project that is not the user's changes nothing, the defaults included.
 * - Anything else is one statement.
 */
export const updateProjectForUser = async ({
  userId,
  projectId,
  changes,
}: {
  userId: string;
  projectId: string;
  changes: ProjectChanges;
}): Promise<UpdateProjectResult> => {
  const toWrite = definedChanges(changes);

  if (!hasChanges(toWrite)) {
    const found = await getProjectOwnedByUser({ projectId, userId });

    return found ? { status: "ok", project: found } : notFound;
  }

  if (toWrite.isDefault !== true) {
    const updated = await updateProjectOwnedByUser({
      projectId,
      userId,
      changes: toWrite,
    });

    return updated ? { status: "ok", project: updated } : notFound;
  }

  return await db.transaction(async (tx): Promise<UpdateProjectResult> => {
    await lockProjectsOfUser({ userId }, tx);

    if (!(await getProjectOwnedByUser({ projectId, userId }, tx))) {
      return notFound;
    }

    await clearDefaultProjects({ userId }, tx);
    const updated = await updateProjectOwnedByUser(
      { projectId, userId, changes: toWrite },
      tx
    );

    return updated ? { status: "ok", project: updated } : notFound;
  });
};
