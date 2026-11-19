import { and, eq } from "drizzle-orm";
import { db } from "@/server/db/connection";
import { project } from "@/server/db/schema";
import { ChatSDKError } from "../../../errors";

export async function deleteProject({
  id,
  userId,
}: {
  id: string;
  userId: string;
}): Promise<void> {
  try {
    await db
      .delete(project)
      .where(and(eq(project.id, id), eq(project.userId, userId)));
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to delete project");
  }
}
