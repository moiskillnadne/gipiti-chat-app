import type { MCPClient } from "@ai-sdk/mcp";
import { jsonSchema, type Tool, tool } from "ai";

import type { IntegrationTurnConnection } from "@/lib/db/query/integration/get-by-ids-for-user";
import type { ToolSnapshotEntry } from "@/lib/db/schema";
import { openMcpClient } from "./client";
import { type McpToolOutput, toModelOutput } from "./result";

export const MAX_TOOLS_PER_TURN = 25;
export const MAX_TOOL_TOKENS_PER_TURN = 6000;
export const MAX_CALLS_PER_TURN = 8;
export const TOOL_CALL_TIMEOUT_MS = 20_000;

export type IntegrationErrorCode =
  | "budget_exceeded"
  | "cancelled_by_user"
  | "timeout"
  | "connect_failed"
  | "unauthorized";

export type IntegrationToolResult =
  | McpToolOutput
  | { ok: false; error: IntegrationErrorCode };

export type IntegrationTurnPlan = {
  tools: Record<string, Tool>;
  close: () => Promise<void>;
};

export type BuildIntegrationTurnPlanInput = {
  connections: IntegrationTurnConnection[];
  turnSignal: AbortSignal;
  stopRequested: AbortSignal;
  /** Injected in tests; defaults to the real client factory. */
  openClient?: typeof openMcpClient;
  callTimeoutMs?: number;
};

class UnauthorizedError extends Error {}

const UNAUTHORIZED_PATTERN = /\b(401|403)\b|unauthori[sz]ed/i;

const noop = (): void => {
  // Intentionally ignored: failures surface through the awaited path.
};

const byName = (a: ToolSnapshotEntry, b: ToolSnapshotEntry): number => {
  if (a.name < b.name) {
    return -1;
  }
  return a.name > b.name ? 1 : 0;
};

const enabledEntries = (
  connection: IntegrationTurnConnection
): ToolSnapshotEntry[] => {
  const enabled = new Set(connection.enabledTools);
  return connection.toolSnapshot
    .filter((entry) => enabled.has(entry.name))
    .sort(byName);
};

/** Keeps whole connections while the per-turn tool count and token budgets hold. */
const applyBudgets = (connections: IntegrationTurnConnection[]) => {
  const kept: {
    connection: IntegrationTurnConnection;
    entries: ToolSnapshotEntry[];
  }[] = [];
  let toolCount = 0;
  let tokens = 0;
  for (const connection of connections) {
    const entries = enabledEntries(connection);
    if (entries.length === 0) {
      continue;
    }
    if (
      toolCount + entries.length > MAX_TOOLS_PER_TURN ||
      tokens + connection.toolTokenEstimate > MAX_TOOL_TOKENS_PER_TURN
    ) {
      console.warn("Integration dropped by turn budget:", {
        integrationId: connection.id,
        toolCount,
        tokens,
      });
      continue;
    }
    toolCount += entries.length;
    tokens += connection.toolTokenEstimate;
    kept.push({ connection, entries });
  }
  return kept;
};

const abortPromise = (signal: AbortSignal): Promise<never> =>
  new Promise((_, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    signal.addEventListener("abort", () => reject(signal.reason), {
      once: true,
    });
  });

/**
 * Builds the AI SDK tools for the integrations selected on this turn. Clients are
 * opened lazily (the first `onInputStart` or `execute`), once per connection, and
 * closed together by `close()`.
 */
export function buildIntegrationTurnPlan({
  connections,
  turnSignal,
  stopRequested,
  openClient = openMcpClient,
  callTimeoutMs = TOOL_CALL_TIMEOUT_MS,
}: BuildIntegrationTurnPlanInput): IntegrationTurnPlan {
  const tools: Record<string, Tool> = {};
  const opened: Promise<MCPClient>[] = [];
  let callCount = 0;
  let closePromise: Promise<void> | undefined;

  const mapFailure = (
    error: unknown,
    timeoutSignal: AbortSignal,
    connectFailed: boolean
  ): IntegrationToolResult => {
    if (stopRequested.aborted || turnSignal.aborted) {
      return { ok: false, error: "cancelled_by_user" };
    }
    if (timeoutSignal.aborted) {
      return { ok: false, error: "timeout" };
    }
    if (
      error instanceof UnauthorizedError ||
      (error instanceof Error && UNAUTHORIZED_PATTERN.test(error.message))
    ) {
      return { ok: false, error: "unauthorized" };
    }
    if (connectFailed) {
      return { ok: false, error: "connect_failed" };
    }
    return {
      ok: false,
      error: "tool_error",
      message: "The tool call failed",
    };
  };

  for (const { connection, entries } of applyBudgets(connections)) {
    let client: Promise<MCPClient> | undefined;
    const connect = (): Promise<MCPClient> => {
      if (!client) {
        client = (async () => {
          if (closePromise) {
            throw new Error("Turn plan is closed");
          }
          if (connection.authType !== "none") {
            // Credentialed connections arrive with M2.
            throw new UnauthorizedError("Credentials are not available");
          }
          return await openClient({
            serverUrl: connection.serverUrl,
            headers: connection.staticHeaders,
            signal: turnSignal,
          });
        })();
        opened.push(client);
      }
      return client;
    };

    const definitions = {
      tools: connection.toolSnapshot.map((entry) => ({
        name: entry.originalName,
        description: entry.description,
        inputSchema: entry.inputSchema as { type: "object" },
      })),
    };

    for (const entry of entries) {
      tools[entry.name] = tool({
        description: entry.description,
        inputSchema: jsonSchema(entry.inputSchema),
        onInputStart: () => {
          // Warm the connection while the model is still streaming arguments.
          connect().catch(noop);
        },
        execute: async (args: unknown): Promise<IntegrationToolResult> => {
          callCount += 1;
          if (callCount > MAX_CALLS_PER_TURN) {
            return { ok: false, error: "budget_exceeded" };
          }

          const timeoutSignal = AbortSignal.timeout(callTimeoutMs);
          const abortSignal = AbortSignal.any([
            turnSignal,
            stopRequested,
            timeoutSignal,
          ]);
          let connectFailed = true;
          const run = async (): Promise<IntegrationToolResult> => {
            const mcpClient = await connect();
            connectFailed = false;
            const mcpTool =
              mcpClient.toolsFromDefinitions(definitions)[entry.originalName];
            const result = await mcpTool.execute(args, {
              abortSignal,
              toolCallId: entry.name,
              messages: [],
            });
            return toModelOutput(result as Parameters<typeof toModelOutput>[0]);
          };
          const running = run();
          // The race settles on abort even when the server ignores the signal.
          running.catch(noop);
          try {
            return await Promise.race([running, abortPromise(abortSignal)]);
          } catch (error) {
            return mapFailure(error, timeoutSignal, connectFailed);
          }
        },
      });
    }
  }

  const close = (): Promise<void> => {
    closePromise ??= (async () => {
      const settled = await Promise.allSettled(opened);
      await Promise.all(
        settled.map(async (outcome, index) => {
          if (outcome.status !== "fulfilled") {
            return;
          }
          try {
            await outcome.value.close();
          } catch (error) {
            console.warn("Failed to close MCP client:", {
              clientIndex: index,
              error,
            });
          }
        })
      );
    })();
    return closePromise;
  };

  return { tools, close };
}
