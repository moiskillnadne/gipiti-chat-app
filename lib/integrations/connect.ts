import { deleteIntegration } from "@/lib/db/query/integration/delete";
import {
  IntegrationAlreadyConnectedError,
  insertIntegration,
} from "@/lib/db/query/integration/insert";
import { listIntegrationsForUser } from "@/lib/db/query/integration/list-for-user";
import { updateIntegrationSnapshot } from "@/lib/db/query/integration/update-snapshot";
import type { IntegrationConnection } from "@/lib/db/schema";
import { getCatalogEntry } from "./catalog";
import { captureToolSnapshot } from "./snapshot";

/** Keys under `integrations.page.errors` in messages/ru.json. */
export type ConnectErrorKey =
  | "unavailable"
  | "unknownIntegration"
  | "alreadyConnected"
  | "notFound"
  | "connectFailed"
  | "generic";

export type ConnectResult =
  | { ok: true }
  | { ok: false; error: ConnectErrorKey };

const failure = (error: ConnectErrorKey): ConnectResult => ({
  ok: false,
  error,
});

const statusFor = (missingAllowlisted: string[], provider: string) => {
  if (missingAllowlisted.length === 0) {
    return "active" as const;
  }
  console.warn("[integrations-drift]", { provider, missingAllowlisted });
  return "needs_review" as const;
};

/** Connects a built-in server that needs no credentials. */
export async function connectBuiltinNoAuth({
  userId,
  catalogId,
  displayName,
}: {
  userId: string;
  catalogId: string;
  /** Localised label, stored so the composer picker can show it. */
  displayName: string;
}): Promise<ConnectResult> {
  const entry = getCatalogEntry(catalogId);
  if (!entry || entry.authType !== "none") {
    return failure("unknownIntegration");
  }

  try {
    const existing = await listIntegrationsForUser({ userId });
    if (existing.some((row) => row.provider === entry.id)) {
      return failure("alreadyConnected");
    }

    const captured = await captureToolSnapshot({ entry }).catch(
      (error: unknown) => {
        console.error("[integrations] snapshot failed", {
          provider: entry.id,
          error: error instanceof Error ? error.message : "unknown",
        });
        return null;
      }
    );
    if (!captured) {
      return failure("connectFailed");
    }

    await insertIntegration({
      userId,
      provider: entry.id,
      displayName,
      serverUrl: entry.serverUrl,
      authType: entry.authType,
      status: statusFor(captured.missingAllowlisted, entry.id),
      trustLevel: "builtin",
      toolSnapshot: captured.snapshot,
      toolSnapshotHash: captured.hash,
      toolSnapshotAt: new Date(),
      toolTokenEstimate: captured.tokenEstimate,
      enabledTools: captured.snapshot.map((tool) => tool.name),
      readOnlyToolNames: captured.snapshot
        .filter((tool) => tool.toolClass === "read")
        .map((tool) => tool.name),
    });
    return { ok: true };
  } catch (error) {
    // A concurrent double connect loses the race on the unique index.
    if (error instanceof IntegrationAlreadyConnectedError) {
      return failure("alreadyConnected");
    }
    console.error("[integrations] connect failed", {
      provider: entry.id,
      error: error instanceof Error ? error.message : "unknown",
    });
    return failure("generic");
  }
}

export async function disconnectIntegrationForUser({
  userId,
  id,
}: {
  userId: string;
  id: string;
}): Promise<ConnectResult> {
  try {
    return (await deleteIntegration({ id, userId }))
      ? { ok: true }
      : failure("notFound");
  } catch {
    return failure("generic");
  }
}

const nextEnabledTools = (
  previous: IntegrationConnection,
  snapshotNames: string[]
): string[] => {
  const known = new Set(previous.toolSnapshot.map((tool) => tool.name));
  const enabled = new Set(previous.enabledTools);
  // Keep the user's choices; tools that are new to the snapshot start enabled.
  return snapshotNames.filter((name) => enabled.has(name) || !known.has(name));
};

/** Re-captures a built-in's tool snapshot, keeping the user's enabled tools. */
export async function refreshBuiltinTools({
  userId,
  id,
}: {
  userId: string;
  id: string;
}): Promise<ConnectResult> {
  try {
    const rows = await listIntegrationsForUser({ userId });
    const current = rows.find((row) => row.id === id);
    const entry = current && getCatalogEntry(current.provider);
    if (!(current && entry) || current.trustLevel !== "builtin") {
      return failure("notFound");
    }

    const captured = await captureToolSnapshot({ entry }).catch(
      (error: unknown) => {
        console.error("[integrations] refresh failed", {
          provider: entry.id,
          error: error instanceof Error ? error.message : "unknown",
        });
        return null;
      }
    );
    if (!captured) {
      return failure("connectFailed");
    }

    const names = captured.snapshot.map((tool) => tool.name);
    const updated = await updateIntegrationSnapshot({
      id,
      userId,
      toolSnapshot: captured.snapshot,
      toolSnapshotHash: captured.hash,
      toolTokenEstimate: captured.tokenEstimate,
      enabledTools: nextEnabledTools(current, names),
      readOnlyToolNames: captured.snapshot
        .filter((tool) => tool.toolClass === "read")
        .map((tool) => tool.name),
      status: statusFor(captured.missingAllowlisted, entry.id),
    });
    return updated ? { ok: true } : failure("notFound");
  } catch (error) {
    console.error("[integrations] refresh failed", {
      id,
      error: error instanceof Error ? error.message : "unknown",
    });
    return failure("generic");
  }
}
