import { type DatabaseExecutor, db } from "@/server/db/connection";
import { type Project, project } from "@/server/db/schema";

export type NewProjectValues = {
  userId: string;
  name: string;
  description: string | null;
  swatch: string | null;
  contextEntries: string[];
  isDefault: boolean;
};

export const insertProject = async (
  values: NewProjectValues,
  executor: DatabaseExecutor = db
): Promise<Project> => {
  const [created] = await executor.insert(project).values(values).returning();

  return created;
};
