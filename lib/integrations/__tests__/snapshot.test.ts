import type { MCPClient } from "@ai-sdk/mcp";
import { describe, expect, it, vi } from "vitest";

import type { CatalogEntry } from "../catalog";
import type { openMcpClient } from "../client";
import { captureToolSnapshot } from "../snapshot";

type FakeTool = {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
};

const objectSchema = { type: "object", properties: {} };
const SHA256_HEX = /^[0-9a-f]{64}$/;

const entry: CatalogEntry = {
  id: "demo",
  serverUrl: "https://example.com/mcp",
  authType: "none",
  sensitivity: "public",
  tools: {
    alpha: { toolClass: "read", description: "Our alpha description" },
    beta: { toolClass: "read", description: "Our beta description" },
  },
};

const asOpener = (client: unknown) =>
  vi
    .fn()
    .mockResolvedValue(client as MCPClient) as unknown as typeof openMcpClient;

const fakeOpener = (pages: FakeTool[][]) => {
  const listTools = vi.fn((args?: { params?: { cursor?: string } }) => {
    const index = args?.params?.cursor ? Number(args.params.cursor) : 0;
    const nextCursor = index + 1 < pages.length ? String(index + 1) : undefined;
    return Promise.resolve({ tools: pages[index], nextCursor });
  });
  const close = vi.fn().mockResolvedValue(undefined);
  return { openClient: asOpener({ listTools, close }), listTools, close };
};

describe("captureToolSnapshot", () => {
  it("keeps only allowlisted tools and uses our descriptions", async () => {
    // Arrange
    const { openClient } = fakeOpener([
      [
        {
          name: "alpha",
          description: "server text",
          inputSchema: objectSchema,
        },
        { name: "beta", inputSchema: objectSchema },
        { name: "gamma", inputSchema: objectSchema },
      ],
    ]);

    // Act
    const result = await captureToolSnapshot({ entry, openClient });

    // Assert
    expect(result.snapshot.map((tool) => tool.originalName)).toEqual([
      "alpha",
      "beta",
    ]);
    expect(result.snapshot[0]).toMatchObject({
      name: "mcp_demo__alpha",
      description: "Our alpha description",
      toolClass: "read",
    });
    expect(result.missingAllowlisted).toEqual([]);
    expect(result.hash).toMatch(SHA256_HEX);
    expect(result.tokenEstimate).toBeGreaterThan(0);
  });

  it("reports allowlisted tools the server no longer lists", async () => {
    // Arrange
    const { openClient } = fakeOpener([
      [{ name: "alpha", inputSchema: objectSchema }],
    ]);

    // Act
    const result = await captureToolSnapshot({ entry, openClient });

    // Assert
    expect(result.missingAllowlisted).toEqual(["beta"]);
    expect(result.snapshot).toHaveLength(1);
  });

  it("follows pagination and closes the client", async () => {
    // Arrange
    const { openClient, listTools, close } = fakeOpener([
      [{ name: "alpha", inputSchema: objectSchema }],
      [{ name: "beta", inputSchema: objectSchema }],
    ]);

    // Act
    const result = await captureToolSnapshot({ entry, openClient });

    // Assert
    expect(listTools).toHaveBeenCalledTimes(2);
    expect(result.snapshot).toHaveLength(2);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("closes the client when listing fails", async () => {
    // Arrange
    const close = vi.fn().mockResolvedValue(undefined);
    const openClient = asOpener({
      listTools: vi.fn().mockRejectedValue(new Error("boom")),
      close,
    });

    // Act
    const run = captureToolSnapshot({ entry, openClient });

    // Assert
    await expect(run).rejects.toThrow("boom");
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("takes every tool of a custom server as write, sanitised, with a custom slug", async () => {
    // Arrange
    const hidden = String.fromCodePoint(0xe_00_49, 0xe_00_67);
    const { openClient } = fakeOpener([
      [
        {
          name: "do-thing",
          description: `Does a thing${hidden}`,
          inputSchema: objectSchema,
        },
        { name: "other", inputSchema: objectSchema },
      ],
    ]);

    // Act
    const result = await captureToolSnapshot({
      customConfig: {
        connectionId: "abcdef12-0000-4000-8000-000000000000",
        serverUrl: "https://custom.example.com/mcp",
      },
      openClient,
    });

    // Assert
    expect(result.missingAllowlisted).toEqual([]);
    expect(result.snapshot.map((tool) => tool.name)).toEqual([
      "mcp_cabcdef__do_thing",
      "mcp_cabcdef__other",
    ]);
    expect(result.snapshot[0]).toMatchObject({
      description: "Does a thing",
      toolClass: "write",
    });
  });

  it("drops tools whose schema is too large", async () => {
    // Arrange
    const huge = {
      type: "object",
      properties: { text: { type: "string", description: "x".repeat(5000) } },
    };
    const { openClient } = fakeOpener([
      [
        { name: "alpha", inputSchema: huge },
        { name: "beta", inputSchema: objectSchema },
      ],
    ]);

    // Act
    const result = await captureToolSnapshot({ entry, openClient });

    // Assert
    expect(result.snapshot.map((tool) => tool.originalName)).toEqual(["beta"]);
  });

  it("produces the same hash regardless of server tool order", async () => {
    // Arrange
    const tools: FakeTool[] = [
      { name: "alpha", inputSchema: objectSchema },
      { name: "beta", inputSchema: objectSchema },
    ];
    const first = fakeOpener([tools]);
    const second = fakeOpener([[...tools].reverse()]);

    // Act
    const a = await captureToolSnapshot({
      entry,
      openClient: first.openClient,
    });
    const b = await captureToolSnapshot({
      entry,
      openClient: second.openClient,
    });

    // Assert
    expect(a.hash).toBe(b.hash);
  });
});
