import { and, eq } from "drizzle-orm";
import { ChatSDKError } from "@/lib/errors";
import { db } from "@/server/db/connection";
import { prompt } from "@/server/db/schema";

/**
 * Whether a prompt with this id is on offer: it exists and is active. A
 * switched-off prompt is hidden from the catalogue, so it counts as absent.
 */
export async function isActivePrompt({
  promptId,
}: {
  promptId: string;
}): Promise<boolean> {
  try {
    const [row] = await db
      .select({ id: prompt.id })
      .from(prompt)
      .where(and(eq(prompt.id, promptId), eq(prompt.isActive, true)))
      .limit(1);

    return row !== undefined;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to look up the prompt"
    );
  }
}
