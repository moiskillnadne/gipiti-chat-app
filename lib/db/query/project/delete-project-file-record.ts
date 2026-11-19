import { and, eq } from "drizzle-orm";
import { db } from "@/server/db/connection";
import { projectFile } from "@/server/db/schema";
import { ChatSDKError } from "../../../errors";

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
