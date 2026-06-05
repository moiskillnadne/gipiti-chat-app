import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { currency } from "@/lib/db/schema";

config({
  path: ".env.local",
});

type CurrencySeed = {
  code: string;
  name: string;
  symbol: string;
  minorUnits: number;
};

// ISO 4217 codes. `minorUnits` is the number of decimal places the currency
// uses; all monetary amounts are stored as integers in this minor unit.
const CURRENCIES: CurrencySeed[] = [
  { code: "RUB", name: "Russian Ruble", symbol: "₽", minorUnits: 2 },
  { code: "USD", name: "US Dollar", symbol: "$", minorUnits: 2 },
  { code: "KZT", name: "Kazakhstani Tenge", symbol: "₸", minorUnits: 2 },
  { code: "BYN", name: "Belarusian Ruble", symbol: "Br", minorUnits: 2 },
];

async function main(): Promise<void> {
  console.log("🌱 Seeding currencies...");

  // biome-ignore lint: Forbidden non-null assertion.
  const client = postgres(process.env.POSTGRES_URL!);
  const db = drizzle(client);

  for (const entry of CURRENCIES) {
    await db
      .insert(currency)
      .values({
        code: entry.code,
        name: entry.name,
        symbol: entry.symbol,
        minorUnits: entry.minorUnits,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: currency.code,
        set: {
          name: entry.name,
          symbol: entry.symbol,
          minorUnits: entry.minorUnits,
          isActive: true,
        },
      });

    console.log(`✅ Upserted currency: ${entry.code} (${entry.symbol})`);
  }

  console.log(`\n🎉 Seeding complete! ${CURRENCIES.length} currencies.`);

  await client.end();
  process.exit(0);
}

main().catch((error) => {
  console.error("❌ Currency seeding failed:", error);
  process.exit(1);
});
