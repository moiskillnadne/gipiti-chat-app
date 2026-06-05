import { eq } from "drizzle-orm";
import { db } from "@/lib/db/connection";
import { type Currency, currency } from "@/lib/db/schema";

/**
 * Fetch a currency dictionary row by ISO 4217 code.
 */
export async function getCurrencyByCode(
  code: string
): Promise<Currency | null> {
  const [row] = await db
    .select()
    .from(currency)
    .where(eq(currency.code, code))
    .limit(1);

  return row ?? null;
}

/**
 * Minor-unit exponent for a currency (defaults to 2 if not found).
 */
export async function getMinorUnits(code: string): Promise<number> {
  const row = await getCurrencyByCode(code);
  return row?.minorUnits ?? 2;
}

/**
 * All active currencies.
 */
export async function getActiveCurrencies(): Promise<Currency[]> {
  return await db.select().from(currency).where(eq(currency.isActive, true));
}
