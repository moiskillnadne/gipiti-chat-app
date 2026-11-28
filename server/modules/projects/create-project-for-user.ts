import { db } from "@/server/db/connection";
import type { Project } from "@/server/db/schema";
import { MAX_PROJECTS_PER_USER } from "@/server/modules/projects/project-limits";
import { clearDefaultProjects } from "@/server/modules/projects/queries/clear-default-projects";
import {
  insertProject,
  type NewProjectValues,
} from "@/server/modules/projects/queries/insert-project";
import { lockProjectsOfUser } from "@/server/modules/projects/queries/lock-projects-of-user";

export type CreateProjectInput = {
  userId: string;
  name: string;
  description?: string | null;
  swatch?: string | null;
  contextEntries?: string[];
  isDefault?: boolean;
};

export type CreateProjectResult =
  | { status: "created"; project: Project }
  | { status: "project_limit_reached"; limit: number };

/**
 * Creates a project, in one transaction behind the user's project lock, so
 * the count below and the insert cannot be overtaken by another create.
 *
 * - A user may have `MAX_PROJECTS_PER_USER` projects: the list endpoint
 *   returns them all, so the number must stay small. The legacy route
 *   `POST /api/projects` is NOT capped.
 * - A new default clears the flag on the user's other projects in the same
 *   transaction, so two calls at once leave exactly one default.
 */
export const createProjectForUser = async ({
  userId,
  name,
  description,
  swatch,
  contextEntries,
  isDefault,
}: CreateProjectInput): Promise<CreateProjectResult> => {
  const values: NewProjectValues = {
    userId,
    name,
    description: description ?? null,
    swatch: swatch ?? null,
    contextEntries: contextEntries ?? [],
    isDefault: isDefault ?? false,
  };

  return await db.transaction(async (tx): Promise<CreateProjectResult> => {
    const existingCount = await lockProjectsOfUser({ userId }, tx);
    if (existingCount >= MAX_PROJECTS_PER_USER) {
      return { status: "project_limit_reached", limit: MAX_PROJECTS_PER_USER };
    }

    if (values.isDefault) {
      await clearDefaultProjects({ userId }, tx);
    }

    return { status: "created", project: await insertProject(values, tx) };
  });
};
