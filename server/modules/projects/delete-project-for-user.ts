import { deleteProjectOwnedByUser } from "@/server/modules/projects/queries/delete-project-owned-by-user";

export type DeleteProjectResult =
  | { status: "deleted" }
  /** No such project, or it is another user's: nothing was deleted. */
  | { status: "project_not_found" };

/**
 * Deletes a project of the user. Only `ProjectFile` references a project, and
 * its rows go in the same statement through the foreign key's cascade. The
 * files in the blob store stay (known, out of scope). The user may be left
 * with no default project, which is allowed.
 */
export const deleteProjectForUser = async ({
  userId,
  projectId,
}: {
  userId: string;
  projectId: string;
}): Promise<DeleteProjectResult> =>
  (await deleteProjectOwnedByUser({ projectId, userId }))
    ? { status: "deleted" }
    : { status: "project_not_found" };
