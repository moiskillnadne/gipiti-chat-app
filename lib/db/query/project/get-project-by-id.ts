import { eq } from "drizzle-orm";

import { ChatSDKError } from "../../../errors";
import { db } from "../../connection";
import { type Project, project } from "../../schema";

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
