import { desc, eq } from "drizzle-orm";
import { ChatSDKError } from "../../../errors";
import { db } from "../../queries";
import { document } from "../../schema";

export async function getGenerationIdByDocumentId({ id }: { id: string }) {
  try {
    const [selectedDocument] = await db
      .select({ generationId: document.generationId })
      .from(document)
      .where(eq(document.id, id))
      .orderBy(desc(document.createdAt));

    return selectedDocument?.generationId ?? null;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get generationId by document id"
    );
  }
}
