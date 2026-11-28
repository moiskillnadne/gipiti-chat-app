import type { Project } from "@/server/db/schema";
import { listProjectsOfUser } from "@/server/modules/projects/queries/list-projects-of-user";

/** Every project of the user. A user cannot grow the list large. */
export const listProjects = async ({
  userId,
}: {
  userId: string;
}): Promise<Project[]> => await listProjectsOfUser({ userId });
