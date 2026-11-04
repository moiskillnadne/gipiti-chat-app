import { supportsMcp } from "@/lib/ai/models";
import {
  getIntegrationsByIdsForUser,
  type IntegrationTurnConnection,
} from "@/lib/db/query/integration/get-by-ids-for-user";
import { isIntegrationsEnabled } from "@/lib/flags";
import { isFreeUserById } from "@/lib/subscription/is-free-user";

export type IntegrationsDenyReason =
  | "flag_off"
  | "free_user"
  | "model_unsupported";

export type AllowedIntegrations = {
  connections: IntegrationTurnConnection[];
  reason?: IntegrationsDenyReason;
};

/**
 * M1 exposes read-class tools only; confirmed writes arrive in M3. Dropping the
 * write entries from the snapshot here keeps them out of the turn plan entirely.
 */
const filterWriteTools = (
  connection: IntegrationTurnConnection
): IntegrationTurnConnection => ({
  ...connection,
  toolSnapshot: connection.toolSnapshot.filter(
    (tool) => tool.toolClass === "read"
  ),
});

/**
 * Decides which of the requested connections may be used on this turn. Checks run
 * cheapest first and the DB is only read once every gate has passed.
 */
export async function resolveAllowedIntegrations({
  userId,
  modelId,
  requestedIds,
}: {
  userId: string;
  modelId: string;
  requestedIds: string[];
}): Promise<AllowedIntegrations> {
  if (requestedIds.length === 0) {
    return { connections: [] };
  }
  if (!(await isIntegrationsEnabled())) {
    return { connections: [], reason: "flag_off" };
  }
  if (await isFreeUserById(userId)) {
    return { connections: [], reason: "free_user" };
  }
  if (!supportsMcp(modelId)) {
    return { connections: [], reason: "model_unsupported" };
  }

  const loaded = await getIntegrationsByIdsForUser({
    userId,
    ids: requestedIds,
  });
  return {
    connections: loaded
      .filter((connection) => connection.status === "active")
      .map(filterWriteTools),
  };
}
