import { eq } from "drizzle-orm";
import { type DatabaseExecutor, db } from "@/server/db/connection";
import { type Currency, currency } from "@/server/db/schema";

/**
 * Fetch a currency dictionary row by ISO 4217 code. Inside a transaction, pass
 * it as `executor` so the read does not take a second pool connection.
 */
export async function getCurrencyByCode(
  code: string,
  executor: DatabaseExecutor = db
): Promise<Currency | null> {
  const [row] = await executor
    .select()
    .from(currency)
    .where(eq(currency.code, code))
    .limit(1);

  return row ?? null;
}

/**
 * Minor-unit exponent for a currency (defaults to 2 if not found). Inside a
 * transaction, pass it as `executor`.
 */
export async function getMinorUnits(
  code: string,
  executor: DatabaseExecutor = db
): Promise<number> {
  const row = await getCurrencyByCode(code, executor);
  return row?.minorUnits ?? 2;
}

/**
 * All active currencies.
 */
export async function getActiveCurrencies(): Promise<Currency[]> {
  return await db.select().from(currency).where(eq(currency.isActive, true));
}
