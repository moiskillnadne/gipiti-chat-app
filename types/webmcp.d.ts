/**
 * WebMCP — https://webmachinelearning.github.io/webmcp/
 *
 * Lets a page hand structured tools to an agent running in the browser. Not in
 * TypeScript's DOM lib, and the shipped surface differs by implementation: the
 * spec draft puts `registerTool` on `document.modelContext`, while Chrome's
 * early preview exposes `navigator.modelContext` with a declarative
 * `provideContext`. Everything below is optional so call sites are forced to
 * feature-detect rather than assume either shape.
 *
 * `interface` rather than `type` because augmenting the global `Navigator` and
 * `Document` requires declaration merging, which type aliases cannot do.
 */

type WebMcpTextContent = {
  type: "text";
  text: string;
};

type WebMcpToolResult = {
  content: WebMcpTextContent[];
};

type WebMcpToolInput = Record<string, unknown>;

type WebMcpTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (
    input: WebMcpToolInput,
    signal?: AbortSignal
  ) => Promise<WebMcpToolResult>;
};

type WebMcpModelContext = {
  /** Chrome early preview: replaces the page's whole tool set. */
  provideContext?: (context: { tools: WebMcpTool[] }) => void;
  /** Spec draft: adds a single tool. */
  registerTool?: (tool: WebMcpTool) => Promise<void> | void;
};

// biome-ignore lint/nursery/useConsistentTypeDefinitions: augmenting the global Navigator needs declaration merging, which a type alias cannot do
interface Navigator {
  readonly modelContext?: WebMcpModelContext;
}

// biome-ignore lint/nursery/useConsistentTypeDefinitions: augmenting the global Document needs declaration merging, which a type alias cannot do
interface Document {
  readonly modelContext?: WebMcpModelContext;
}
