import { and, eq } from "drizzle-orm";

import { ChatSDKError } from "../../../errors";
import { db } from "../../connection";
import {
  type IntegrationConnection,
  integrationConnection,
  type ToolSnapshotEntry,
} from "../../schema";

/** Returns true when a row owned by `userId` was updated. */
export async function updateIntegrationSnapshot({
  id,
  userId,
  toolSnapshot,
  toolSnapshotHash,
  toolTokenEstimate,
  enabledTools,
  readOnlyToolNames,
  status,
}: {
  id: string;
  userId: string;
  toolSnapshot: ToolSnapshotEntry[];
  toolSnapshotHash: string;
  toolTokenEstimate: number;
  enabledTools: string[];
  readOnlyToolNames: string[];
  status: IntegrationConnection["status"];
}): Promise<boolean> {
  try {
    const now = new Date();
    const updated = await db
      .update(integrationConnection)
      .set({
        toolSnapshot,
        toolSnapshotHash,
        toolSnapshotAt: now,
        toolTokenEstimate,
        enabledTools,
        readOnlyToolNames,
        status,
        updatedAt: now,
      })
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
      "Failed to update integration snapshot"
    );
  }
}
