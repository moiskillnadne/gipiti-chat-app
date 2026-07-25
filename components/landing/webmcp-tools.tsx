"use client";

import { useEffect } from "react";

import { webMcpTools } from "@/lib/agent-discovery/webmcp-tools";

/**
 * Registers this site's WebMCP tools so an agent driving the browser can query
 * the model catalog and pricing directly instead of scraping the page.
 *
 * Progressive enhancement: WebMCP ships behind a flag in Chrome's early preview
 * and nowhere else, so every branch here is feature-detected and the component
 * is inert in a normal browser. Two shapes are supported because the spec draft
 * (`document.modelContext.registerTool`) and the preview implementation
 * (`navigator.modelContext.provideContext`) disagree.
 */
export const WebMcpTools = (): null => {
  useEffect(() => {
    const modelContext = navigator.modelContext ?? document.modelContext;

    if (!modelContext) {
      return;
    }

    if (modelContext.provideContext) {
      modelContext.provideContext({ tools: webMcpTools });
      return;
    }

    const { registerTool } = modelContext;

    if (!registerTool) {
      return;
    }

    for (const tool of webMcpTools) {
      // Registration is per-tool and may reject on an unsupported descriptor;
      // one bad tool must not take down the rest of the page.
      Promise.resolve(registerTool.call(modelContext, tool)).catch(() => {
        // Ignored: the agent simply does not get this tool.
      });
    }
  }, []);

  return null;
};
