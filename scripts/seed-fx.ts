import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { fxRate } from "@/lib/db/schema";

config({ path: ".env.local" });

// Baseline USD→currency rates so billing pricing works before the first cron
// refresh (and in local dev). Refreshed hourly by /api/cron/refresh-fx-rates.
const BASELINE_RATES: Record<string, number> = {
  RUB: 90,
  KZT: 480,
  BYN: 3.2,
};

async function main(): Promise<void> {
  console.log("🌱 Seeding baseline FX rates...");

  // biome-ignore lint: Forbidden non-null assertion.
  const client = postgres(process.env.POSTGRES_URL!);
  const db = drizzle(client);

  for (const [quoteCurrency, rate] of Object.entries(BASELINE_RATES)) {
    await db.insert(fxRate).values({
      baseCurrency: "USD",
      quoteCurrency,
      rate: rate.toString(),
      source: "seed-baseline",
    });
    console.log(`✅ USD→${quoteCurrency}: ${rate}`);
  }

  console.log("\n🎉 Baseline FX rates seeded. Refreshed hourly via the cron.");
  await client.end();
  process.exit(0);
}

main().catch((error) => {
  console.error("❌ FX seeding failed:", error);
  process.exit(1);
});
