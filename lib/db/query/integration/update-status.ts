import { and, eq } from "drizzle-orm";

import { ChatSDKError } from "../../../errors";
import { db } from "../../connection";
import {
  type IntegrationConnection,
  integrationConnection,
} from "../../schema";

/** Returns true when a row owned by `userId` was updated. */
export async function updateIntegrationStatus({
  id,
  userId,
  status,
}: {
  id: string;
  userId: string;
  status: IntegrationConnection["status"];
}): Promise<boolean> {
  try {
    const updated = await db
      .update(integrationConnection)
      .set({ status, updatedAt: new Date() })
      .where(
        and(
          eq(integrationConnection.id, id),
          eq(integrationConnection.userId, userId)
        )
      )
      .returning({ id: integrationConnection.id });
    return updated.length > 0;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update integration status"
    );
  }
}
