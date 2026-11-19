import { db } from "@/server/db/connection";
import { type ProjectFile, projectFile } from "@/server/db/schema";
import { ChatSDKError } from "../../../errors";

export async function createProjectFile({
  projectId,
  userId,
  name,
  size,
  mimeType,
  blobUrl,
  pathname,
}: {
  projectId: string;
  userId: string;
  name: string;
  size: number;
  mimeType: string;
  blobUrl: string;
  pathname: string;
}): Promise<ProjectFile> {
  try {
    const [created] = await db
      .insert(projectFile)
      .values({ projectId, userId, name, size, mimeType, blobUrl, pathname })
      .returning();
    return created;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to create project file"
    );
  }
}
