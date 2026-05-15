import { desc, eq } from "drizzle-orm";

import { ChatSDKError } from "../../../errors";
import { db } from "../../connection";
import { type Project, project } from "../../schema";

export async function getProjectsByUserId({
  userId,
}: {
  userId: string;
}): Promise<Project[]> {
  try {
    return await db
      .select()
      .from(project)
      .where(eq(project.userId, userId))
      .orderBy(desc(project.updatedAt));
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to fetch projects");
  }
}
