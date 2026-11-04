import { createMCPClient, type MCPClient } from "@ai-sdk/mcp";

export const MCP_CONNECT_TIMEOUT_MS = 5000;

export type OpenMcpClientOptions = {
  serverUrl: string;
  headers?: Record<string, string>;
  /** Defaults to global fetch in M1; M2-T3 swaps the default to `safeFetch`. */
  fetch?: typeof globalThis.fetch;
  signal?: AbortSignal;
};

/**
 * Opens a Streamable HTTP MCP client. It advertises no capabilities (no sampling,
 * no elicitation, no roots) and callers must never read `client.instructions`:
 * server text is not forwarded to the model.
 */
export function openMcpClient({
  serverUrl,
  headers,
  fetch = globalThis.fetch,
  signal,
}: OpenMcpClientOptions): Promise<MCPClient> {
  return createMCPClient({
    transport: {
      type: "http",
      url: serverUrl,
      headers: {
        ...headers,
        Accept: "application/json, text/event-stream",
      },
      redirect: "error",
      fetch,
    },
    capabilities: {},
    initializationOptions: { timeout: MCP_CONNECT_TIMEOUT_MS, signal },
  });
}
