import { and, desc, eq } from "drizzle-orm";

import { ChatSDKError } from "../../../errors";
import { db } from "../../queries";
import { type ProjectFile, projectFile } from "../../schema";

export async function getProjectFiles({
  projectId,
  userId,
}: {
  projectId: string;
  userId: string;
}): Promise<ProjectFile[]> {
  try {
    return await db
      .select()
      .from(projectFile)
      .where(
        and(
          eq(projectFile.projectId, projectId),
          eq(projectFile.userId, userId)
        )
      )
      .orderBy(desc(projectFile.createdAt));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to fetch project files"
    );
  }
}
