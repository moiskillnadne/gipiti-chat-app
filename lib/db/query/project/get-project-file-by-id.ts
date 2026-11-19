import { eq } from "drizzle-orm";
import { db } from "@/server/db/connection";
import { type ProjectFile, projectFile } from "@/server/db/schema";
import { ChatSDKError } from "../../../errors";

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
