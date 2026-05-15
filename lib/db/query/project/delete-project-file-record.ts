import { and, eq } from "drizzle-orm";

import { ChatSDKError } from "../../../errors";
import { db } from "../../connection";
import { projectFile } from "../../schema";

export async function deleteProjectFileRecord({
  id,
  userId,
}: {
  id: string;
  userId: string;
}): Promise<void> {
  try {
    await db
      .delete(projectFile)
      .where(and(eq(projectFile.id, id), eq(projectFile.userId, userId)));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete project file"
    );
  }
}
