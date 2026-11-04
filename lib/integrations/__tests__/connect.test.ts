import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IntegrationConnection } from "@/lib/db/schema";

const mocks = vi.hoisted(() => ({
  AlreadyConnected: class extends Error {},
  captureToolSnapshot: vi.fn(),
  insertIntegration: vi.fn(),
  listIntegrationsForUser: vi.fn(),
  updateIntegrationSnapshot: vi.fn(),
  deleteIntegration: vi.fn(),
}));

vi.mock("../snapshot", () => ({
  captureToolSnapshot: mocks.captureToolSnapshot,
}));
vi.mock("@/lib/db/query/integration/insert", () => ({
  IntegrationAlreadyConnectedError: mocks.AlreadyConnected,
  insertIntegration: mocks.insertIntegration,
}));
vi.mock("@/lib/db/query/integration/list-for-user", () => ({
  listIntegrationsForUser: mocks.listIntegrationsForUser,
}));
vi.mock("@/lib/db/query/integration/update-snapshot", () => ({
  updateIntegrationSnapshot: mocks.updateIntegrationSnapshot,
}));
vi.mock("@/lib/db/query/integration/delete", () => ({
  deleteIntegration: mocks.deleteIntegration,
}));

import {
  connectBuiltinNoAuth,
  disconnectIntegrationForUser,
  refreshBuiltinTools,
} from "../connect";

const entry = (name: string, toolClass: "read" | "write" = "read") => ({
  name,
  originalName: name,
  description: "d",
  inputSchema: {},
  toolClass,
});

const captured = (missingAllowlisted: string[] = []) => ({
  snapshot: [entry("mcp_deepwiki__a"), entry("mcp_deepwiki__b", "write")],
  hash: "hash",
  tokenEstimate: 42,
  missingAllowlisted,
});

const connect = () =>
  connectBuiltinNoAuth({
    userId: "u1",
    catalogId: "deepwiki",
    displayName: "DeepWiki",
  });

describe("connectBuiltinNoAuth", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "warn").mockReturnValue(undefined);
    vi.spyOn(console, "error").mockReturnValue(undefined);
    mocks.listIntegrationsForUser.mockResolvedValue([]);
    mocks.captureToolSnapshot.mockResolvedValue(captured());
    mocks.insertIntegration.mockResolvedValue({});
  });

  it("rejects an unknown catalog id without touching the network", async () => {
    const result = await connectBuiltinNoAuth({
      userId: "u1",
      catalogId: "nope",
      displayName: "x",
    });

    expect(result).toEqual({ ok: false, error: "unknownIntegration" });
    expect(mocks.captureToolSnapshot).not.toHaveBeenCalled();
  });

  it("inserts an active builtin with every tool enabled and reads auto-run", async () => {
    const result = await connect();

    expect(result).toEqual({ ok: true });
    expect(mocks.insertIntegration).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        provider: "deepwiki",
        displayName: "DeepWiki",
        trustLevel: "builtin",
        status: "active",
        enabledTools: ["mcp_deepwiki__a", "mcp_deepwiki__b"],
        readOnlyToolNames: ["mcp_deepwiki__a"],
        toolTokenEstimate: 42,
      })
    );
  });

  it("marks needs_review and logs drift when allowlisted tools vanished", async () => {
    mocks.captureToolSnapshot.mockResolvedValue(
      captured(["ask_wiki_question"])
    );

    await connect();

    expect(mocks.insertIntegration).toHaveBeenCalledWith(
      expect.objectContaining({ status: "needs_review" })
    );
    expect(console.warn).toHaveBeenCalledWith(
      "[integrations-drift]",
      expect.objectContaining({ provider: "deepwiki" })
    );
  });

  it("returns alreadyConnected without calling the server", async () => {
    mocks.listIntegrationsForUser.mockResolvedValue([{ provider: "deepwiki" }]);

    expect(await connect()).toEqual({ ok: false, error: "alreadyConnected" });
    expect(mocks.captureToolSnapshot).not.toHaveBeenCalled();
  });

  it("maps a snapshot failure to connectFailed without leaking the message", async () => {
    mocks.captureToolSnapshot.mockRejectedValue(new Error("secret detail"));

    const result = await connect();

    expect(result).toEqual({ ok: false, error: "connectFailed" });
    expect(mocks.insertIntegration).not.toHaveBeenCalled();
  });

  it("maps a database failure to generic", async () => {
    mocks.insertIntegration.mockRejectedValue(new Error("db down"));

    expect(await connect()).toEqual({ ok: false, error: "generic" });
  });

  it("maps a lost unique-index race to alreadyConnected", async () => {
    mocks.insertIntegration.mockRejectedValue(new mocks.AlreadyConnected());

    expect(await connect()).toEqual({ ok: false, error: "alreadyConnected" });
  });
});

describe("disconnectIntegrationForUser", () => {
  beforeEach(() => vi.resetAllMocks());

  it("reports notFound when no row was deleted", async () => {
    mocks.deleteIntegration.mockResolvedValue(false);

    expect(
      await disconnectIntegrationForUser({ userId: "u1", id: "i1" })
    ).toEqual({ ok: false, error: "notFound" });
  });

  it("succeeds when a row was deleted", async () => {
    mocks.deleteIntegration.mockResolvedValue(true);

    expect(
      await disconnectIntegrationForUser({ userId: "u1", id: "i1" })
    ).toEqual({ ok: true });
  });
});

describe("refreshBuiltinTools", () => {
  const existing = {
    id: "i1",
    provider: "deepwiki",
    trustLevel: "builtin",
    toolSnapshot: [entry("mcp_deepwiki__a")],
    enabledTools: [],
  } as unknown as IntegrationConnection;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "warn").mockReturnValue(undefined);
    vi.spyOn(console, "error").mockReturnValue(undefined);
    mocks.listIntegrationsForUser.mockResolvedValue([existing]);
    mocks.captureToolSnapshot.mockResolvedValue(captured());
    mocks.updateIntegrationSnapshot.mockResolvedValue(true);
  });

  it("keeps a tool the user disabled and enables newly appeared ones", async () => {
    const result = await refreshBuiltinTools({ userId: "u1", id: "i1" });

    expect(result).toEqual({ ok: true });
    expect(mocks.updateIntegrationSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "i1",
        userId: "u1",
        status: "active",
        enabledTools: ["mcp_deepwiki__b"],
      })
    );
  });

  it("reports notFound for a connection the user does not own", async () => {
    mocks.listIntegrationsForUser.mockResolvedValue([]);

    expect(await refreshBuiltinTools({ userId: "u1", id: "i1" })).toEqual({
      ok: false,
      error: "notFound",
    });
    expect(mocks.captureToolSnapshot).not.toHaveBeenCalled();
  });

  it("flags needs_review on drift", async () => {
    mocks.captureToolSnapshot.mockResolvedValue(captured(["x"]));

    await refreshBuiltinTools({ userId: "u1", id: "i1" });

    expect(mocks.updateIntegrationSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ status: "needs_review" })
    );
  });
});
