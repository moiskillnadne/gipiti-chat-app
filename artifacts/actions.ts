"use server";

import { getSuggestionsByDocumentId } from "@/lib/db/query/document/get-suggestions-by-document-id";

export async function getSuggestions({ documentId }: { documentId: string }) {
  const suggestions = await getSuggestionsByDocumentId({ documentId });
  return suggestions ?? [];
}
