import { and, eq, sql } from "drizzle-orm";
import { db } from "@/server/db/connection";
import { project } from "@/server/db/schema";
import { ChatSDKError } from "../../../errors";

export async function incrementProjectUsage({
  id,
  userId,
}: {
  id: string;
  userId: string;
}): Promise<void> {
  try {
    await db
      .update(project)
      .set({ usageCount: sql`${project.usageCount} + 1` })
      .where(and(eq(project.id, id), eq(project.userId, userId)));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to increment project usage"
    );
  }
}
