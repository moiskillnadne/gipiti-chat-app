import { gateway } from "@ai-sdk/gateway";
import { generateText, jsonSchema, type ToolSet, tool } from "ai";
import { config } from "dotenv";
import { CATALOG } from "@/lib/integrations/catalog";
import { captureToolSnapshot } from "@/lib/integrations/snapshot";

config({ path: ".env.local" });

/**
 * G0 schema eval: does each model accept each catalog entry's live tool schemas?
 * One trivial `generateText` call per (entry, model) pair through the AI Gateway.
 * COSTS MONEY, so it refuses to run without --yes.
 * Usage: npx tsx scripts/integrations/schema-eval.ts --models a/b,c/d --yes [--entries id,id]
 */
const USAGE =
  "Usage: npx tsx scripts/integrations/schema-eval.ts --models <gatewayId,...> --yes [--entries <id,...>]";
const PROMPT = "What can you do with the tools you have? Answer in one word.";
const MAX_OUTPUT_TOKENS = 16;
const MAX_ERROR_CHARS = 120;

type EvalArgs = { models: string[]; entries: string[]; yes: boolean };

const readList = (value: string | undefined): string[] =>
  (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

function parseArgs(argv: string[]): EvalArgs {
  const args: EvalArgs = { models: [], entries: [], yes: false };
  const iter = argv[Symbol.iterator]();
  for (const arg of iter) {
    if (arg === "--yes") {
      args.yes = true;
    } else if (arg === "--models") {
      args.models = readList(iter.next().value);
    } else if (arg === "--entries") {
      args.entries = readList(iter.next().value);
    }
  }
  return args;
}

type Row = {
  entry: string;
  model: string;
  tools: number;
  verdict: string;
};

async function evalPair(
  tools: ToolSet,
  modelId: string
): Promise<{ ok: boolean; note: string }> {
  try {
    await generateText({
      model: gateway.languageModel(modelId),
      prompt: PROMPT,
      tools,
      toolChoice: "auto",
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    });
    return { ok: true, note: "" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      note: message.replace(/\s+/g, " ").slice(0, MAX_ERROR_CHARS),
    };
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.models.length === 0) {
    console.error(USAGE);
    process.exit(1);
  }
  if (!args.yes) {
    console.error(
      "Refusing to run: this makes paid model calls. Re-run with --yes to confirm."
    );
    process.exit(1);
  }

  const entries = CATALOG.filter(
    (entry) => args.entries.length === 0 || args.entries.includes(entry.id)
  );
  const rows: Row[] = [];

  for (const entry of entries) {
    const { snapshot, missingAllowlisted } = await captureToolSnapshot({
      entry,
    });
    const expected = Object.keys(entry.tools).length;
    const dropped = expected - missingAllowlisted.length - snapshot.length;
    if (missingAllowlisted.length > 0 || dropped > 0 || snapshot.length === 0) {
      // A partial or empty ToolSet would "accept" trivially and hide untested schemas.
      const reason = `SKIPPED (missing: ${missingAllowlisted.join(", ") || "none"}, dropped: ${Math.max(dropped, 0)})`;
      for (const model of args.models) {
        rows.push({
          entry: entry.id,
          model,
          tools: snapshot.length,
          verdict: reason,
        });
      }
      continue;
    }
    const tools: ToolSet = {};
    for (const item of snapshot) {
      tools[item.name] = tool({
        description: item.description,
        inputSchema: jsonSchema(item.inputSchema),
      });
    }
    for (const model of args.models) {
      const { ok, note } = await evalPair(tools, model);
      rows.push({
        entry: entry.id,
        model,
        tools: snapshot.length,
        verdict: ok ? "accept" : `REJECT ${note}`,
      });
    }
  }

  console.table(rows);
  if (
    rows.some(
      (row) =>
        row.verdict.startsWith("REJECT") || row.verdict.startsWith("SKIPPED")
    )
  ) {
    process.exitCode = 2;
  }
}

main().catch((error: unknown) => {
  console.error(
    "Eval failed:",
    error instanceof Error ? error.message : String(error)
  );
  process.exit(1);
});
