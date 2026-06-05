import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { prompt } from "@/lib/db/schema";
import { validateSheetRows } from "@/lib/prompts/prompt-seed";
import { fetchPromptSheetRows } from "@/lib/prompts/prompt-sheet";
import {
  applySyncPlan,
  buildSyncPlan,
  type ExistingPrompt,
  type SyncPlan,
} from "@/lib/prompts/prompt-sync";

config({ path: ".env.local" });

type CliFlags = { dryRun: boolean; prune: boolean };

function parseFlags(argv: string[]): CliFlags {
  return {
    dryRun: argv.includes("--dry-run"),
    prune: argv.includes("--prune"),
  };
}

function printUsage(): void {
  console.error(
    "❌ Missing PROMPTS_SHEET_ID. Add the spreadsheet id (from its URL) to .env.local."
  );
  console.error(
    "   Optional: PROMPTS_SHEET_GID (tab id) or PROMPTS_SHEET_NAME (tab name)."
  );
  console.error(
    "   Usage: npx tsx scripts/sync-prompts.ts [--dry-run] [--prune]"
  );
}

function printPlan(plan: SyncPlan, flags: CliFlags): void {
  console.log("\n📋 Plan:");
  console.log(`   • Insert:     ${plan.toInsert.length}`);
  console.log(`   • Update:     ${plan.toUpdate.length}`);
  console.log(`   • Unchanged:  ${plan.unchanged}`);
  if (flags.prune) {
    console.log(
      `   • Delete:     ${plan.toPrune.length}  ⚠️  also removes these from users' favorites (cascade)`
    );
  } else {
    console.log(`   • Deactivate: ${plan.toDeactivate.length}`);
  }

  for (const seed of plan.toInsert) {
    console.log(`     + ${seed.key} — ${seed.title}`);
  }
  for (const seed of plan.toUpdate) {
    console.log(`     ~ ${seed.key} — ${seed.title}`);
  }
  for (const key of flags.prune ? plan.toPrune : plan.toDeactivate) {
    console.log(`     - ${key}`);
  }
}

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));
  const sheetId = process.env.PROMPTS_SHEET_ID;

  if (!sheetId) {
    printUsage();
    process.exit(1);
  }

  console.log("🌱 Syncing prompt catalog from Google Sheets...");
  if (flags.dryRun) {
    console.log("   (dry run — no changes will be applied)");
  }

  const rows = await fetchPromptSheetRows({
    sheetId,
    gid: process.env.PROMPTS_SHEET_GID,
    sheetName: process.env.PROMPTS_SHEET_NAME,
  });
  console.log(`📥 Fetched ${rows.length} row(s) from the sheet.`);

  const { seeds, errors } = validateSheetRows(rows);

  if (errors.length > 0) {
    console.error(`\n❌ Validation failed for ${errors.length} row(s):`);
    for (const rowError of errors) {
      const label = rowError.key ? ` [${rowError.key}]` : "";
      console.error(
        `   Row ${rowError.rowNumber}${label}: ${rowError.messages.join("; ")}`
      );
    }
    console.error("\nNo changes applied. Fix the sheet and re-run.");
    process.exit(1);
  }

  if (seeds.length === 0) {
    console.error(
      "❌ The sheet produced 0 valid prompts. Refusing to sync, since this would deactivate the whole catalog. Check PROMPTS_SHEET_GID / PROMPTS_SHEET_NAME."
    );
    process.exit(1);
  }

  // biome-ignore lint: Forbidden non-null assertion.
  const client = postgres(process.env.POSTGRES_URL!);
  const db = drizzle(client);

  const existing: ExistingPrompt[] = await db
    .select({
      key: prompt.key,
      category: prompt.category,
      modelId: prompt.modelId,
      title: prompt.title,
      body: prompt.body,
      tags: prompt.tags,
      sortOrder: prompt.sortOrder,
      isActive: prompt.isActive,
    })
    .from(prompt);

  const plan = buildSyncPlan(seeds, existing);
  printPlan(plan, flags);

  if (flags.dryRun) {
    console.log("\n✅ Dry run complete — no changes applied.");
    await client.end();
    process.exit(0);
  }

  await applySyncPlan(db, plan, { prune: flags.prune });

  console.log("\n🎉 Sync complete.");
  await client.end();
  process.exit(0);
}

main().catch((error) => {
  console.error("❌ Prompt sync failed:", error);
  process.exit(1);
});
