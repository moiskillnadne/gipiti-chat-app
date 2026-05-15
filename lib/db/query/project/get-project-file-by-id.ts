import { eq } from "drizzle-orm";

import { ChatSDKError } from "../../../errors";
import { db } from "../../connection";
import { type ProjectFile, projectFile } from "../../schema";

export async function getProjectFileById({
  id,
}: {
  id: string;
}): Promise<ProjectFile | undefined> {
  try {
    const [found] = await db
      .select()
      .from(projectFile)
      .where(eq(projectFile.id, id));
    return found;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to fetch project file"
    );
  }
}
