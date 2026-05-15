import { eq } from "drizzle-orm";

import { ChatSDKError } from "../../../errors";
import { db } from "../../queries";
import { type Project, project } from "../../schema";

export async function createProject({
  userId,
  name,
  description,
  swatch,
  contextEntries = [],
  isDefault = false,
}: {
  userId: string;
  name: string;
  description?: string | null;
  swatch?: string | null;
  contextEntries?: string[];
  isDefault?: boolean;
}): Promise<Project> {
  try {
    if (isDefault) {
      await db
        .update(project)
        .set({ isDefault: false })
        .where(eq(project.userId, userId));
    }

    const [created] = await db
      .insert(project)
      .values({
        userId,
        name,
        description: description ?? null,
        swatch: swatch ?? null,
        contextEntries,
        isDefault,
      })
      .returning();
    return created;
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to create project");
  }
}
