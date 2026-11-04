import { and, eq } from "drizzle-orm";

import { ChatSDKError } from "../../../errors";
import { db } from "../../connection";
import { integrationConnection } from "../../schema";

/** Returns true when a row owned by `userId` was deleted. */
export async function deleteIntegration({
  id,
  userId,
}: {
  id: string;
  userId: string;
}): Promise<boolean> {
  try {
    const deleted = await db
      .delete(integrationConnection)
      .where(
        and(
          eq(integrationConnection.id, id),
          eq(integrationConnection.userId, userId)
        )
      )
      .returning({ id: integrationConnection.id });
    return deleted.length > 0;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete integration"
    );
  }
}
