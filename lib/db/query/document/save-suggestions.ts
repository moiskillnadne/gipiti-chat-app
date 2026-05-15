import { ChatSDKError } from "../../../errors";
import { db } from "../../queries";
import { type Suggestion, suggestion } from "../../schema";

export async function saveSuggestions({
  suggestions,
}: {
  suggestions: Suggestion[];
}) {
  try {
    return await db.insert(suggestion).values(suggestions);
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to save suggestions"
    );
  }
}
