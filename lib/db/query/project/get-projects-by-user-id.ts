import { desc, eq } from "drizzle-orm";
import { db } from "@/server/db/connection";
import { type Project, project } from "@/server/db/schema";
import { ChatSDKError } from "../../../errors";

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
