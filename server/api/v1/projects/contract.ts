import { oc } from "@orpc/contract";

import { callerAccess } from "@/server/api/_kit/caller-access";
import {
  forbiddenError,
  notFoundError,
  unauthorizedError,
} from "@/server/api/_kit/common-errors";
import {
  createProjectInputSchema,
  projectIdInputSchema,
  projectListSchema,
  projectSchema,
  updateProjectInputSchema,
} from "@/server/api/v1/_schemas/project";
import { projectCreateConflictWithReason } from "@/server/api/v1/_schemas/project-errors";

const PROJECTS_TAGS = ["projects"];

const OWNERSHIP_NOTE =
  "404 when there is no such project, which is also the answer for a project of another account.";

export const projectsContract = {
  list: oc
    .errors({ ...unauthorizedError })
    .route({
      method: "GET",
      path: "/projects",
      spec: callerAccess("required"),
      summary: "The user's projects",
      description:
        "All the caller's projects as one list, most recently changed first. Needs an access token or a browser session.",
      tags: PROJECTS_TAGS,
    })
    .output(projectListSchema),

  create: oc
    .errors({
      ...unauthorizedError,
      ...forbiddenError,
      ...projectCreateConflictWithReason,
    })
    .route({
      method: "POST",
      path: "/projects",
      spec: callerAccess("required"),
      successStatus: 201,
      summary: "Create a project",
      description:
        "With `isDefault: true` the flag is cleared on the caller's other projects in the same step. 409 `project_limit_reached` (with `data.limit`) when the caller already has the most projects a user may have.",
      tags: PROJECTS_TAGS,
    })
    .input(createProjectInputSchema)
    .output(projectSchema),

  get: oc
    .errors({ ...unauthorizedError, ...notFoundError })
    .route({
      method: "GET",
      path: "/projects/{projectId}",
      spec: callerAccess("required"),
      summary: "One project",
      description: `Needs an access token or a browser session. ${OWNERSHIP_NOTE}`,
      tags: PROJECTS_TAGS,
    })
    .input(projectIdInputSchema)
    .output(projectSchema),

  update: oc
    .errors({ ...unauthorizedError, ...forbiddenError, ...notFoundError })
    .route({
      method: "PATCH",
      path: "/projects/{projectId}",
      spec: callerAccess("required"),
      summary: "Change a project",
      description: `Changes the fields that are present and leaves the others. \`null\` clears \`description\` or \`swatch\`. An empty body changes nothing. \`isDefault: true\` moves the default to this project in one step. ${OWNERSHIP_NOTE}`,
      tags: PROJECTS_TAGS,
    })
    .input(updateProjectInputSchema)
    .output(projectSchema),

  remove: oc
    .errors({ ...unauthorizedError, ...forbiddenError, ...notFoundError })
    .route({
      method: "DELETE",
      path: "/projects/{projectId}",
      spec: callerAccess("required"),
      successStatus: 204,
      summary: "Delete a project",
      description: `Deletes the project and its file records. ${OWNERSHIP_NOTE}`,
      tags: PROJECTS_TAGS,
    })
    .input(projectIdInputSchema),
};
