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
  | "model_unsupported"
  | "error";

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

/**
 * Chat-path wrapper: a failed gate never errors the turn. Requested ids are
 * dropped and the reason code is logged (no ids or tool data in the log).
 */
export async function resolveAllowedIntegrationsSafe({
  chatId,
  ...input
}: {
  chatId: string;
  userId: string;
  modelId: string;
  requestedIds: string[];
}): Promise<AllowedIntegrations> {
  const allowed = await resolveAllowedIntegrations(input).catch(
    (error: unknown): AllowedIntegrations => {
      console.error("[integrations] gate failed", {
        chatId,
        error: error instanceof Error ? error.name : "unknown",
      });
      return { connections: [], reason: "error" };
    }
  );
  if (allowed.connections.length === 0 && input.requestedIds.length > 0) {
    console.info("[integrations] requested ids dropped", {
      chatId,
      reason: allowed.reason ?? "none_active",
    });
  }
  return allowed;
}
