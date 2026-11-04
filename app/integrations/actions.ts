"use server";

import { auth } from "@/app/(auth)/auth";
import { listIntegrationsForUser } from "@/lib/db/query/integration/list-for-user";
import { ChatSDKError } from "@/lib/errors";

export type MyIntegration = {
  id: string;
  displayName: string;
  provider: string;
  toolTokenEstimate: number;
};

/** The signed-in user's active connections, for the composer picker. */
export async function listMyIntegrations(): Promise<MyIntegration[]> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new ChatSDKError("unauthorized:auth");
  }
  const connections = await listIntegrationsForUser({
    userId: session.user.id,
  });
  return connections
    .filter((connection) => connection.status === "active")
    .map(({ id, displayName, provider, toolTokenEstimate }) => ({
      id,
      displayName,
      provider,
      toolTokenEstimate,
    }));
}
