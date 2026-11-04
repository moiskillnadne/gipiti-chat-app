import { config } from "dotenv";
import { captureToolSnapshot } from "@/lib/integrations/snapshot";

config({ path: ".env.local" });

/**
 * Probe an MCP server: lists `tools/list`, sizes, token estimate and the sanitised,
 * normalised snapshot that would be stored. Header values are never printed.
 * Usage: npx tsx scripts/integrations/probe-server.ts <url> [--header k:v]...
 */
const USAGE =
  "Usage: npx tsx scripts/integrations/probe-server.ts <url> [--header k:v]...";
const PROBE_CONNECTION_ID = "00000000-0000-0000-0000-000000000000";

type ProbeArgs = { url: string; headers: Record<string, string> };

function parseArgs(argv: string[]): ProbeArgs | null {
  let url: string | undefined;
  const headers: Record<string, string> = {};
  const iter = argv[Symbol.iterator]();
  for (const arg of iter) {
    if (arg === "--header") {
      const raw: string = iter.next().value ?? "";
      const sep = raw.indexOf(":");
      if (sep <= 0) {
        return null;
      }
      headers[raw.slice(0, sep).trim()] = raw.slice(sep + 1).trim();
    } else if (url || arg.startsWith("--")) {
      return null;
    } else {
      url = arg;
    }
  }
  return url ? { url, headers } : null;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args) {
    console.error(USAGE);
    process.exit(1);
  }

  const headerNames = Object.keys(args.headers);
  console.log(`Server: ${args.url}`);
  console.log(
    `Headers sent: ${headerNames.length > 0 ? headerNames.join(", ") : "(none)"}`
  );

  const result = await captureToolSnapshot({
    customConfig: { connectionId: PROBE_CONNECTION_ID, serverUrl: args.url },
    headers: args.headers,
  });

  console.log(`\nTools kept after sanitising: ${result.snapshot.length}`);
  for (const tool of result.snapshot) {
    const bytes = Buffer.byteLength(JSON.stringify(tool), "utf8");
    console.log(`  ${tool.name}  (${tool.originalName}, ${bytes} bytes)`);
  }
  console.log(`\nToken estimate: ~${result.tokenEstimate}`);
  console.log(`Definitions hash: ${result.hash}`);
  console.log("\nSnapshot:");
  console.log(JSON.stringify(result.snapshot, null, 2));
}

main().catch((error: unknown) => {
  console.error(
    "Probe failed:",
    error instanceof Error ? error.message : String(error)
  );
  process.exit(1);
});
