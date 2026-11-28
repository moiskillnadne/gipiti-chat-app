import { and, eq } from "drizzle-orm";
import { ChatSDKError } from "@/lib/errors";
import { db } from "@/server/db/connection";
import { type Project, project } from "@/server/db/schema";

export async function getDefaultProject({
  userId,
}: {
  userId: string;
}): Promise<Project | undefined> {
  try {
    const [found] = await db
      .select()
      .from(project)
      .where(and(eq(project.userId, userId), eq(project.isDefault, true)));
    return found;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to fetch default project"
    );
  }
}
