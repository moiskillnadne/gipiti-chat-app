import { desc, eq } from "drizzle-orm";
import { db } from "@/server/db/connection";
import { document } from "@/server/db/schema";
import { ChatSDKError } from "../../../errors";

export async function getDocumentById({ id }: { id: string }) {
  try {
    const [selectedDocument] = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(desc(document.createdAt));

    return selectedDocument;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get document by id"
    );
  }
}
