import { describe, expect, it } from "vitest";
import type { ChatMessage } from "@/lib/types";
import { groupToolRuns } from "../group-tool-runs";

const parts = (...items: unknown[]) => items as ChatMessage["parts"];

describe("groupToolRuns", () => {
  it("folds MCP tool parts into the run group", () => {
    const input = parts(
      {
        type: "tool-mcp_deepwiki__ask_wiki_question",
        state: "output-available",
      },
      { type: "text", text: "answer" }
    );

    const result = groupToolRuns(input);

    expect(result[0]).toMatchObject({ type: "run-group" });
    expect(result[1]).toMatchObject({ type: "text" });
  });
});
