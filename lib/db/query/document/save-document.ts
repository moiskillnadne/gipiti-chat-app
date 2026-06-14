import { ChatSDKError } from "../../../errors";
import { db } from "../../connection";
import { document } from "../../schema";

export type DocumentKind = "image" | "video" | "pdf";

export async function saveDocument({
  id,
  title,
  kind,
  content,
  userId,
  generationId,
}: {
  id: string;
  title: string;
  kind: DocumentKind;
  content: string;
  userId: string;
  generationId?: string | null;
}) {
  try {
    return await db
      .insert(document)
      .values({
        id,
        title,
        kind,
        content,
        userId,
        generationId: generationId ?? null,
        createdAt: new Date(),
      })
      .returning();
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to save document");
  }
}
