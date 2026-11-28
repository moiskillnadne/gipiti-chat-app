import { requireAuth } from "@/server/api/_kit/middleware";
import { toProjectDto } from "@/server/api/v1/_mappers/project";
import { v1 } from "@/server/api/v1/implementer";
import { createProjectForUser } from "@/server/modules/projects/create-project-for-user";
import { deleteProjectForUser } from "@/server/modules/projects/delete-project-for-user";
import { getProject } from "@/server/modules/projects/get-project";
import { listProjects } from "@/server/modules/projects/list-projects";
import { updateProjectForUser } from "@/server/modules/projects/update-project-for-user";

export const projectsRouter = {
  list: v1.projects.list.use(requireAuth).handler(async ({ context }) => ({
    items: (await listProjects({ userId: context.principal.userId })).map(
      toProjectDto
    ),
  })),

  create: v1.projects.create
    .use(requireAuth)
    .handler(async ({ input, context, errors }) => {
      const result = await createProjectForUser({
        userId: context.principal.userId,
        name: input.name,
        description: input.description,
        swatch: input.swatch,
        contextEntries: input.contextEntries,
        isDefault: input.isDefault,
      });

      switch (result.status) {
        case "created":
          return toProjectDto(result.project);
        case "project_limit_reached":
          throw errors.CONFLICT({
            data: { reason: "project_limit_reached", limit: result.limit },
          });
        default: {
          const unhandled: never = result;
          throw new Error(`Unhandled result: ${JSON.stringify(unhandled)}`);
        }
      }
    }),

  get: v1.projects.get
    .use(requireAuth)
    .handler(async ({ input, context, errors }) => {
      const result = await getProject({
        userId: context.principal.userId,
        projectId: input.projectId,
      });

      switch (result.status) {
        case "ok":
          return toProjectDto(result.project);
        case "project_not_found":
          throw errors.NOT_FOUND();
        default: {
          const unhandled: never = result;
          throw new Error(`Unhandled result: ${JSON.stringify(unhandled)}`);
        }
      }
    }),

  update: v1.projects.update
    .use(requireAuth)
    .handler(async ({ input, context, errors }) => {
      const { projectId, ...changes } = input;
      const result = await updateProjectForUser({
        userId: context.principal.userId,
        projectId,
        changes,
      });

      switch (result.status) {
        case "ok":
          return toProjectDto(result.project);
        case "project_not_found":
          throw errors.NOT_FOUND();
        default: {
          const unhandled: never = result;
          throw new Error(`Unhandled result: ${JSON.stringify(unhandled)}`);
        }
      }
    }),

  remove: v1.projects.remove
    .use(requireAuth)
    .handler(async ({ input, context, errors }) => {
      const result = await deleteProjectForUser({
        userId: context.principal.userId,
        projectId: input.projectId,
      });

      switch (result.status) {
        case "deleted":
          return;
        case "project_not_found":
          throw errors.NOT_FOUND();
        default: {
          const unhandled: never = result;
          throw new Error(`Unhandled result: ${JSON.stringify(unhandled)}`);
        }
      }
    }),
};
