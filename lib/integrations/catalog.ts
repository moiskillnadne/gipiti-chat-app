import type { ToolSnapshotEntry } from "@/lib/db/schema";

export type CatalogToolClass = ToolSnapshotEntry["toolClass"];

export type CatalogTool = {
  toolClass: CatalogToolClass;
  /** Short English description shown to the model. Ours, never the server's. */
  description: string;
  /**
   * Our descriptions for the tool's top-level input properties, keyed by property name. The
   * server's own property descriptions are dropped at snapshot time, so a property without an
   * entry here reaches the model with no description at all.
   */
  inputDescriptions?: Record<string, string>;
};

export type CatalogEntry = {
  /** Also the tool-name slug (`mcp_<id>__<tool>`), so it must stay `[a-z0-9_]`. */
  id: string;
  serverUrl: string;
  readWriteServerUrl?: string;
  authType: "none" | "oauth" | "static_header";
  header?: { name: string; scheme: string };
  staticHeaderKeys?: string[];
  oauth?: { scope: string };
  sensitivity: "public" | "private";
  /** Allowlist keyed by the tool name the server reports. */
  tools: Record<string, CatalogTool>;
};

// UI labels and descriptions live in messages/ru.json under `integrations.catalog.<id>`.
export const CATALOG: readonly CatalogEntry[] = [
  {
    id: "deepwiki",
    serverUrl: "https://mcp.deepwiki.com/mcp",
    authType: "none",
    sensitivity: "public",
    tools: {
      ask_wiki_question: {
        toolClass: "read",
        description:
          "Ask a question about a public GitHub repository and get an answer grounded in its DeepWiki documentation. Pass the repository as owner/repo.",
        inputDescriptions: {
          repoName:
            "Repository as owner/repo, or a list of up to 10 repositories.",
          question: "The question to answer from the repository documentation.",
        },
      },
      read_wiki_contents: {
        toolClass: "read",
        description:
          "Read the full DeepWiki documentation of a public GitHub repository, given as owner/repo.",
        inputDescriptions: {
          repoName: "Repository as owner/repo, for example facebook/react.",
        },
      },
      read_wiki_structure: {
        toolClass: "read",
        description:
          "List the documentation topics available in the DeepWiki of a public GitHub repository, given as owner/repo.",
        inputDescriptions: {
          repoName: "Repository as owner/repo, for example facebook/react.",
        },
      },
    },
  },
  {
    id: "context7",
    serverUrl: "https://mcp.context7.com/mcp",
    authType: "none",
    sensitivity: "public",
    tools: {
      "resolve-library-id": {
        toolClass: "read",
        description:
          "Find the Context7 library id for a package or framework name. Call this first, before querying docs.",
        inputDescriptions: {
          libraryName:
            "Official library or framework name with its punctuation, for example Next.js or Three.js.",
          query:
            "What the user wants to find in the docs; used to rank matching libraries. Never include secrets or private data.",
        },
      },
      "query-docs": {
        toolClass: "read",
        description:
          "Fetch up-to-date documentation and code examples for a library, using an id from resolve-library-id and a focused question.",
        inputDescriptions: {
          libraryId:
            "Context7 library id from resolve-library-id, in the form /org/project or /org/project/version.",
          query:
            "One specific question or topic per call; make separate calls for unrelated concepts. Never include secrets or private data.",
          language:
            "Programming language of the user's code, for example TypeScript or Python. Omit when unknown.",
        },
      },
    },
  },
];

export function getCatalogEntry(id: string): CatalogEntry | undefined {
  return CATALOG.find((entry) => entry.id === id);
}
