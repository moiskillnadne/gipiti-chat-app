import { and, eq, inArray } from "drizzle-orm";

import { ChatSDKError } from "../../../errors";
import { db } from "../../connection";
import {
  type IntegrationConnection,
  integrationConnection,
} from "../../schema";

/** Chat-path projection: identity, status and snapshot fields only. */
export type IntegrationTurnConnection = Pick<
  IntegrationConnection,
  | "id"
  | "provider"
  | "displayName"
  | "serverUrl"
  | "authType"
  | "authHeaderName"
  | "authHeaderScheme"
  | "staticHeaders"
  | "status"
  | "trustLevel"
  | "allowWrites"
  | "accessTokenExpiresAt"
  | "toolSnapshot"
  | "toolSnapshotHash"
  | "toolTokenEstimate"
  | "enabledTools"
  | "readOnlyToolNames"
>;

export async function getIntegrationsByIdsForUser({
  userId,
  ids,
}: {
  userId: string;
  ids: string[];
}): Promise<IntegrationTurnConnection[]> {
  if (ids.length === 0) {
    return [];
  }
  try {
    return await db
      .select({
        id: integrationConnection.id,
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
        toolSnapshot: integrationConnection.toolSnapshot,
        toolSnapshotHash: integrationConnection.toolSnapshotHash,
        toolTokenEstimate: integrationConnection.toolTokenEstimate,
        enabledTools: integrationConnection.enabledTools,
        readOnlyToolNames: integrationConnection.readOnlyToolNames,
      })
      .from(integrationConnection)
      .where(
        and(
          eq(integrationConnection.userId, userId),
          inArray(integrationConnection.id, ids)
        )
      );
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to fetch integrations"
    );
  }
}
