import { desc, eq } from "drizzle-orm";

import { ChatSDKError } from "../../../errors";
import { db } from "../../connection";
import {
  type IntegrationConnection,
  integrationConnection,
} from "../../schema";

export async function listIntegrationsForUser({
  userId,
}: {
  userId: string;
}): Promise<IntegrationConnection[]> {
  try {
    return await db
      .select({
        id: integrationConnection.id,
        userId: integrationConnection.userId,
        provider: integrationConnection.provider,
        displayName: integrationConnection.displayName,
        serverUrl: integrationConnection.serverUrl,
        authType: integrationConnection.authType,
        authHeaderName: integrationConnection.authHeaderName,
        authHeaderScheme: integrationConnection.authHeaderScheme,
        staticHeaders: integrationConnection.staticHeaders,
        status: integrationConnection.status,
        trustLevel: integrationConnection.trustLevel,
        allowWrites: integrationConnection.allowWrites,
        accessTokenExpiresAt: integrationConnection.accessTokenExpiresAt,
        scopes: integrationConnection.scopes,
        toolSnapshot: integrationConnection.toolSnapshot,
        toolSnapshotHash: integrationConnection.toolSnapshotHash,
        toolSnapshotAt: integrationConnection.toolSnapshotAt,
        toolTokenEstimate: integrationConnection.toolTokenEstimate,
        enabledTools: integrationConnection.enabledTools,
        readOnlyToolNames: integrationConnection.readOnlyToolNames,
        createdAt: integrationConnection.createdAt,
        updatedAt: integrationConnection.updatedAt,
        lastUsedAt: integrationConnection.lastUsedAt,
      })
      .from(integrationConnection)
      .where(eq(integrationConnection.userId, userId))
      .orderBy(desc(integrationConnection.createdAt));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to list integrations"
    );
  }
}
