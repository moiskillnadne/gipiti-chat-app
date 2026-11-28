/** Seeding and inspection helpers for the project integration tests. */
import { randomUUID } from "node:crypto";

import { eq, inArray, sql } from "drizzle-orm";

import { db } from "@/server/db/connection";
import { project, projectFile, user } from "@/server/db/schema";

export const seedUser = async (): Promise<string> => {
  const [row] = await db
    .insert(user)
    .values({ email: `project-it-${randomUUID()}@example.test` })
    .returning({ id: user.id });

  return row.id;
};

/** Deleting users cascades to their projects and project files. */
export const deleteUsers = async (userIds: string[]): Promise<void> => {
  if (userIds.length > 0) {
    await db.delete(user).where(inArray(user.id, userIds));
  }
};

export const seedProject = async ({
  userId,
  name = "Project",
  isDefault = false,
  updatedAt,
}: {
  userId: string;
  name?: string;
  isDefault?: boolean;
  /** `YYYY-MM-DD HH:MM:SS`, read by Postgres as a `timestamp`. */
  updatedAt?: string;
}): Promise<string> => {
  const id = randomUUID();
  await db.execute(
    sql`INSERT INTO "Project" ("id", "user_id", "name", "context_entries", "is_default", "updated_at")
        VALUES (${id}::uuid, ${userId}::uuid, ${name}, '[]'::jsonb, ${isDefault},
                COALESCE(${updatedAt ?? null}::timestamp, now()))`
  );

  return id;
};

export const seedProjectFile = async ({
  projectId,
  userId,
}: {
  projectId: string;
  userId: string;
}): Promise<string> => {
  const [row] = await db
    .insert(projectFile)
    .values({
      projectId,
      userId,
      name: "notes.txt",
      size: 10,
      mimeType: "text/plain",
      blobUrl: "https://blob.example.test/notes.txt",
      pathname: "notes.txt",
    })
    .returning({ id: projectFile.id });

  return row.id;
};

export const readDefaultProjectIds = async (
  userId: string
): Promise<string[]> => {
  const rows = await db
    .select({ id: project.id })
    .from(project)
    .where(sql`${project.userId} = ${userId} AND ${project.isDefault}`);

  return rows.map(({ id }) => id);
};

export const readProjectIds = async (userId: string): Promise<string[]> => {
  const rows = await db
    .select({ id: project.id })
    .from(project)
    .where(eq(project.userId, userId));

  return rows.map(({ id }) => id);
};

export const readProjectFileIds = async (
  projectIds: string[]
): Promise<string[]> => {
  const rows = await db
    .select({ id: projectFile.id })
    .from(projectFile)
    .where(inArray(projectFile.projectId, projectIds));

  return rows.map(({ id }) => id);
};

export const readProjectUpdatedAt = async (
  projectId: string
): Promise<string> => {
  const [row] = await db
    .select({ updatedAt: sql<string>`${project.updatedAt}::text` })
    .from(project)
    .where(eq(project.id, projectId));

  return row.updatedAt;
};

/**
 * Makes the database refuse to insert a project with this name, so a test can
 * make the last statement of a default switch fail. Returns the function that
 * removes the trigger; call it before cleaning up.
 */
export const refuseInsertsOfProjectNamed = async (
  name: string
): Promise<() => Promise<void>> => {
  const triggerName = "it_refuse_insert_project";
  await db.execute(
    sql.raw(`CREATE OR REPLACE FUNCTION ${triggerName}() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'integration test: insert refused'; END;
      $$ LANGUAGE plpgsql`)
  );
  // A run that was killed leaves its trigger behind.
  await db.execute(
    sql.raw(`DROP TRIGGER IF EXISTS ${triggerName} ON "Project"`)
  );
  await db.execute(
    sql.raw(`CREATE TRIGGER ${triggerName} BEFORE INSERT ON "Project"
      FOR EACH ROW WHEN (NEW."name" = '${name}')
      EXECUTE FUNCTION ${triggerName}()`)
  );

  return async () => {
    await db.execute(
      sql.raw(`DROP TRIGGER IF EXISTS ${triggerName} ON "Project"`)
    );
    await db.execute(sql.raw(`DROP FUNCTION IF EXISTS ${triggerName}()`));
  };
};

/** Many plain projects for one user, in one insert. */
export const seedProjects = async ({
  userId,
  count,
}: {
  userId: string;
  count: number;
}): Promise<void> => {
  await db.insert(project).values(
    Array.from({ length: count }, (_, index) => ({
      userId,
      name: `Seeded ${index}`,
      contextEntries: [],
    }))
  );
};
