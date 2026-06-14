import { desc, eq } from "drizzle-orm";
import { ChatSDKError } from "../../../errors";
import { db } from "../../connection";
import { document } from "../../schema";

/**
 * Resolve the most recent Document by its provider `generationId` (the
 * image-edit chain key), not its primary key. Used to look up the previous
 * image when refining/editing a generated image, since the client round-trips
 * the generationId — not the Document id.
 */
export async function getDocumentByGenerationId({
  generationId,
}: {
  generationId: string;
}) {
  try {
    const [selectedDocument] = await db
      .select()
      .from(document)
      .where(eq(document.generationId, generationId))
      .orderBy(desc(document.createdAt));

    return selectedDocument;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get document by generation id"
    );
  }
}
