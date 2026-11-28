import type { Project } from "@/server/db/schema";
import { getProjectOwnedByUser } from "@/server/modules/projects/queries/get-project-owned-by-user";

export type GetProjectResult =
  | { status: "ok"; project: Project }
  /** No such project, or it is another user's: one answer for both. */
  | { status: "project_not_found" };

export const getProject = async ({
  userId,
  projectId,
}: {
  userId: string;
  projectId: string;
}): Promise<GetProjectResult> => {
  const found = await getProjectOwnedByUser({ projectId, userId });

  return found
    ? { status: "ok", project: found }
    : { status: "project_not_found" };
};
