import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IntegrationTurnConnection } from "@/lib/db/query/integration/get-by-ids-for-user";

const mocks = vi.hoisted(() => ({
  isIntegrationsEnabled: vi.fn(),
  isFreeUserById: vi.fn(),
  supportsMcp: vi.fn(),
  getIntegrationsByIdsForUser: vi.fn(),
}));

vi.mock("@/lib/flags", () => ({
  isIntegrationsEnabled: mocks.isIntegrationsEnabled,
}));
vi.mock("@/lib/subscription/is-free-user", () => ({
  isFreeUserById: mocks.isFreeUserById,
}));
vi.mock("@/lib/ai/models", () => ({ supportsMcp: mocks.supportsMcp }));
vi.mock("@/lib/db/query/integration/get-by-ids-for-user", () => ({
  getIntegrationsByIdsForUser: mocks.getIntegrationsByIdsForUser,
}));

import { resolveAllowedIntegrations } from "../policy";

const input = { userId: "user-1", modelId: "model-1", requestedIds: ["c1"] };

const connection = (
  status: IntegrationTurnConnection["status"],
  id = "c1"
): IntegrationTurnConnection =>
  ({
    id,
    status,
    toolSnapshot: [
      { name: "r", toolClass: "read" },
      { name: "w", toolClass: "write" },
    ],
  }) as unknown as IntegrationTurnConnection;

describe("resolveAllowedIntegrations", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.isIntegrationsEnabled.mockResolvedValue(true);
    mocks.isFreeUserById.mockResolvedValue(false);
    mocks.supportsMcp.mockReturnValue(true);
    mocks.getIntegrationsByIdsForUser.mockResolvedValue([connection("active")]);
  });

  it("short-circuits on empty ids without touching the flag or DB", async () => {
    const result = await resolveAllowedIntegrations({
      ...input,
      requestedIds: [],
    });

    expect(result).toEqual({ connections: [] });
    expect(mocks.isIntegrationsEnabled).not.toHaveBeenCalled();
    expect(mocks.getIntegrationsByIdsForUser).not.toHaveBeenCalled();
  });

  it("short-circuits when the flag is off", async () => {
    mocks.isIntegrationsEnabled.mockResolvedValue(false);

    const result = await resolveAllowedIntegrations(input);

    expect(result).toEqual({ connections: [], reason: "flag_off" });
    expect(mocks.getIntegrationsByIdsForUser).not.toHaveBeenCalled();
  });

  it("short-circuits for a free user", async () => {
    mocks.isFreeUserById.mockResolvedValue(true);

    const result = await resolveAllowedIntegrations(input);

    expect(result).toEqual({ connections: [], reason: "free_user" });
    expect(mocks.getIntegrationsByIdsForUser).not.toHaveBeenCalled();
  });

  it("short-circuits for a model without MCP support", async () => {
    mocks.supportsMcp.mockReturnValue(false);

    const result = await resolveAllowedIntegrations(input);

    expect(result).toEqual({ connections: [], reason: "model_unsupported" });
    expect(mocks.getIntegrationsByIdsForUser).not.toHaveBeenCalled();
  });

  it("keeps only active connections", async () => {
    mocks.getIntegrationsByIdsForUser.mockResolvedValue([
      connection("active", "a"),
      connection("needs_reauth", "b"),
    ]);

    const result = await resolveAllowedIntegrations(input);

    expect(result.connections.map((item) => item.id)).toEqual(["a"]);
  });

  it("keeps read-class tools only", async () => {
    const result = await resolveAllowedIntegrations(input);

    expect(result.connections[0].toolSnapshot.map((tool) => tool.name)).toEqual(
      ["r"]
    );
  });
});
