import type { MCPClient } from "@ai-sdk/mcp";
import { describe, expect, it, vi } from "vitest";

import type { IntegrationTurnConnection } from "@/lib/db/query/integration/get-by-ids-for-user";
import type { ToolSnapshotEntry } from "@/lib/db/schema";
import type { openMcpClient } from "../client";
import { buildIntegrationTurnPlan } from "../turn-plan";

const entry = (name: string): ToolSnapshotEntry => ({
  name: `mcp_demo__${name}`,
  originalName: name,
  description: `Tool ${name}`,
  inputSchema: { type: "object", properties: {} },
  toolClass: "read",
});

const makeConnection = (
  overrides: Partial<IntegrationTurnConnection> = {}
): IntegrationTurnConnection => {
  const snapshot = [entry("beta"), entry("alpha")];
  return {
    id: "conn-1",
    provider: "demo",
    displayName: "Demo",
    serverUrl: "https://example.com/mcp",
    authType: "none",
    authHeaderName: null,
    authHeaderScheme: null,
    staticHeaders: {},
    status: "active",
    trustLevel: "builtin",
    allowWrites: false,
    accessTokenExpiresAt: null,
    toolSnapshot: snapshot,
    toolSnapshotHash: "hash",
    toolTokenEstimate: 100,
    enabledTools: snapshot.map((item) => item.name),
    readOnlyToolNames: [],
    ...overrides,
  };
};

type FakeClient = {
  client: MCPClient;
  execute: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
};

const makeFakeClient = (
  execute: (args: unknown, options: { abortSignal?: AbortSignal }) => unknown
): FakeClient => {
  const executeFn = vi.fn(execute);
  const close = vi.fn(() => Promise.resolve());
  const client = {
    toolsFromDefinitions: () =>
      new Proxy({}, { get: () => ({ execute: executeFn }) }),
    close,
  } as unknown as MCPClient;
  return { client, execute: executeFn, close };
};

const okResult = { content: [{ type: "text", text: "hello" }] };

const setup = (
  options: {
    execute?: Parameters<typeof makeFakeClient>[0];
    openClient?: typeof openMcpClient;
    connections?: IntegrationTurnConnection[];
    callTimeoutMs?: number;
  } = {}
) => {
  const fake = makeFakeClient(options.execute ?? (async () => okResult));
  const openClient = vi.fn(
    options.openClient ?? (async () => fake.client)
  ) as unknown as typeof openMcpClient;
  const turn = new AbortController();
  const stop = new AbortController();
  const plan = buildIntegrationTurnPlan({
    connections: options.connections ?? [makeConnection()],
    turnSignal: turn.signal,
    stopRequested: stop.signal,
    openClient,
    callTimeoutMs: options.callTimeoutMs,
  });
  return { fake, openClient, plan, turn, stop };
};

const run = (plan: ReturnType<typeof buildIntegrationTurnPlan>, name: string) =>
  (
    plan.tools[name].execute as (
      args: unknown,
      options: { toolCallId: string; messages: never[] }
    ) => Promise<unknown>
  )({}, { toolCallId: "call-1", messages: [] });

describe("buildIntegrationTurnPlan", () => {
  it("exposes enabled tools sorted by name", () => {
    const { plan } = setup({
      connections: [
        makeConnection({ enabledTools: ["mcp_demo__beta", "mcp_demo__alpha"] }),
      ],
    });

    expect(Object.keys(plan.tools)).toEqual([
      "mcp_demo__alpha",
      "mcp_demo__beta",
    ]);
  });

  it("skips tools that are not enabled", () => {
    const { plan } = setup({
      connections: [makeConnection({ enabledTools: ["mcp_demo__alpha"] })],
    });

    expect(Object.keys(plan.tools)).toEqual(["mcp_demo__alpha"]);
  });

  it("drops later connections over the token budget", () => {
    const first = makeConnection({ id: "a", toolTokenEstimate: 5000 });
    const second = makeConnection({
      id: "b",
      toolTokenEstimate: 2000,
      toolSnapshot: [entry("gamma")],
      enabledTools: ["mcp_demo__gamma"],
    });
    const { plan } = setup({ connections: [first, second] });

    expect(Object.keys(plan.tools)).not.toContain("mcp_demo__gamma");
  });

  it("drops later connections over the tool count budget", () => {
    const many = Array.from({ length: 24 }, (_, i) => entry(`t${i}`));
    const first = makeConnection({
      id: "a",
      toolSnapshot: many,
      enabledTools: many.map((item) => item.name),
    });
    const second = makeConnection({ id: "b" });
    const { plan } = setup({ connections: [first, second] });

    expect(Object.keys(plan.tools)).toHaveLength(24);
  });

  it("returns from onInputStart before connect resolves", async () => {
    let release: (client: MCPClient) => void = () => {
      // replaced below
    };
    const pending = new Promise<MCPClient>((resolve) => {
      release = resolve;
    });
    const { plan, openClient, fake } = setup({
      openClient: (() => pending) as unknown as typeof openMcpClient,
    });

    const result = (
      plan.tools.mcp_demo__alpha.onInputStart as (o: unknown) => unknown
    )({ toolCallId: "call-1", messages: [] });

    expect(result).toBeUndefined();
    expect(openClient).toHaveBeenCalledTimes(1);
    release(fake.client);
    await plan.close();
    expect(fake.close).toHaveBeenCalledTimes(1);
  });

  it("connects in execute without a prior onInputStart", async () => {
    const { plan, openClient } = setup();

    const result = await run(plan, "mcp_demo__alpha");

    expect(result).toBe("hello");
    expect(openClient).toHaveBeenCalledTimes(1);
  });

  it("opens one client per connection across calls", async () => {
    const { plan, openClient } = setup();

    await run(plan, "mcp_demo__alpha");
    await run(plan, "mcp_demo__beta");

    expect(openClient).toHaveBeenCalledTimes(1);
  });

  it("resolves cancelled_by_user within one tick of stop", async () => {
    const { plan, stop } = setup({
      execute: () =>
        new Promise<never>(() => {
          // never settles
        }),
    });

    const pending = run(plan, "mcp_demo__alpha");
    await new Promise((resolve) => setTimeout(resolve, 0));
    stop.abort(new DOMException("user-stop", "AbortError"));

    await expect(pending).resolves.toEqual({
      ok: false,
      error: "cancelled_by_user",
    });
  });

  it("resolves timeout when the call outlives its budget", async () => {
    const { plan } = setup({
      execute: () =>
        new Promise<never>(() => {
          // never settles
        }),
      callTimeoutMs: 20,
    });

    await expect(run(plan, "mcp_demo__alpha")).resolves.toEqual({
      ok: false,
      error: "timeout",
    });
  });

  it("resolves connect_failed when the client cannot open", async () => {
    const { plan } = setup({
      openClient: (() => {
        throw new Error("boom");
      }) as unknown as typeof openMcpClient,
    });

    await expect(run(plan, "mcp_demo__alpha")).resolves.toEqual({
      ok: false,
      error: "connect_failed",
    });
  });

  it("resolves unauthorized for credentialed connections in M1", async () => {
    const { plan } = setup({
      connections: [makeConnection({ authType: "oauth" })],
    });

    await expect(run(plan, "mcp_demo__alpha")).resolves.toEqual({
      ok: false,
      error: "unauthorized",
    });
  });

  it("resolves tool_error when the call throws", async () => {
    const { plan } = setup({
      execute: () => {
        throw new Error("secret server detail");
      },
    });

    await expect(run(plan, "mcp_demo__alpha")).resolves.toEqual({
      ok: false,
      error: "tool_error",
      message: "The tool call failed",
    });
  });

  it("refuses the ninth call with budget_exceeded", async () => {
    const { plan, fake } = setup();

    const results: unknown[] = [];
    for (let i = 0; i < 9; i++) {
      results.push(await run(plan, "mcp_demo__alpha"));
    }

    expect(results[7]).toBe("hello");
    expect(results[8]).toEqual({ ok: false, error: "budget_exceeded" });
    expect(fake.execute).toHaveBeenCalledTimes(8);
  });

  it("closes every opened client once and tolerates a double close", async () => {
    const { plan, fake } = setup();
    await run(plan, "mcp_demo__alpha");

    await plan.close();
    await plan.close();

    expect(fake.close).toHaveBeenCalledTimes(1);
  });

  it("swallows close errors", async () => {
    const { plan, fake } = setup();
    fake.close.mockRejectedValueOnce(new Error("close failed"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {
      // silence
    });
    await run(plan, "mcp_demo__alpha");

    await expect(plan.close()).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
