import { eq } from "drizzle-orm";
import { db } from "@/server/db/connection";
import { type Project, project } from "@/server/db/schema";
import { ChatSDKError } from "../../../errors";

export async function getProjectById({
  id,
}: {
  id: string;
}): Promise<Project | undefined> {
  try {
    const [found] = await db.select().from(project).where(eq(project.id, id));
    return found;
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to fetch project");
  }
}
