"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { listIntegrationsForUser } from "@/lib/db/query/integration/list-for-user";
import { ChatSDKError } from "@/lib/errors";
import { getTranslations } from "@/lib/i18n/translate";
import { isIntegrationsAvailableForUser } from "@/lib/integrations/availability";
import {
  type ConnectResult,
  connectBuiltinNoAuth as connectBuiltin,
  disconnectIntegrationForUser,
  refreshBuiltinTools,
} from "@/lib/integrations/connect";

export type MyIntegration = {
  id: string;
  displayName: string;
  provider: string;
  toolTokenEstimate: number;
};

const catalogIdSchema = z.string().min(1).max(64);
const connectionIdSchema = z.string().uuid();

/** Session, flag and paid-status gate shared by every mutation. */
async function requireIntegrationsUser(): Promise<
  { userId: string } | { error: ConnectResult }
> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new ChatSDKError("unauthorized:auth");
  }
  if (!(await isIntegrationsAvailableForUser(session.user.id))) {
    return { error: { ok: false, error: "unavailable" } };
  }
  return { userId: session.user.id };
}

async function runMutation(
  run: (userId: string) => Promise<ConnectResult>
): Promise<ConnectResult> {
  const gate = await requireIntegrationsUser();
  if ("error" in gate) {
    return gate.error;
  }
  const result = await run(gate.userId);
  if (result.ok) {
    revalidatePath("/integrations");
  }
  return result;
}

export function connectBuiltinNoAuth(catalogId: string) {
  return runMutation(async (userId): Promise<ConnectResult> => {
    const parsed = catalogIdSchema.safeParse(catalogId);
    if (!parsed.success) {
      return { ok: false, error: "unknownIntegration" };
    }
    const t = await getTranslations("integrations.catalog");
    return connectBuiltin({
      userId,
      catalogId: parsed.data,
      displayName: t(`${parsed.data}.name`),
    });
  });
}

export function disconnectIntegration(id: string) {
  return runMutation((userId): Promise<ConnectResult> => {
    const parsed = connectionIdSchema.safeParse(id);
    if (!parsed.success) {
      return Promise.resolve({ ok: false, error: "notFound" });
    }
    return disconnectIntegrationForUser({ userId, id: parsed.data });
  });
}

export function refreshIntegrationTools(id: string) {
  return runMutation((userId): Promise<ConnectResult> => {
    const parsed = connectionIdSchema.safeParse(id);
    if (!parsed.success) {
      return Promise.resolve({ ok: false, error: "notFound" });
    }
    return refreshBuiltinTools({ userId, id: parsed.data });
  });
}

/** The signed-in user's active connections, for the composer picker. */
export async function listMyIntegrations(): Promise<MyIntegration[]> {
  const gate = await requireIntegrationsUser();
  if ("error" in gate) {
    return [];
  }
  const connections = await listIntegrationsForUser({ userId: gate.userId });
  return connections
    .filter((connection) => connection.status === "active")
    .map(({ id, displayName, provider, toolTokenEstimate }) => ({
      id,
      displayName,
      provider,
      toolTokenEstimate,
    }));
}
