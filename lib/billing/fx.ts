import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/connection";
import { currency, fxRate } from "@/lib/db/schema";
import { getMinorUnits } from "./currencies";

// Free, no-key USD-based rates API covering all our quote currencies.
const FX_API_URL = "https://open.er-api.com/v6/latest/USD";
const FX_SOURCE = "open.er-api.com";

type ErApiResponse = {
  result: string;
  base_code: string;
  rates: Record<string, number>;
};

/**
 * Latest cached USD→quote rate (quote-currency units per 1 USD). Returns null
 * when no rate is cached yet; USD resolves to 1 without a lookup.
 */
export async function getLatestFxRate(
  quoteCurrency: string
): Promise<number | null> {
  if (quoteCurrency === "USD") {
    return 1;
  }

  const [row] = await db
    .select({ rate: fxRate.rate })
    .from(fxRate)
    .where(eq(fxRate.quoteCurrency, quoteCurrency))
    .orderBy(desc(fxRate.fetchedAt))
    .limit(1);

  return row ? Number(row.rate) : null;
}

/** What converting a USD cost into a currency's minor units needs. */
export type CurrencyPricing = {
  minorUnits: number;
  /** Latest cached USD→currency rate, or null when none is cached yet. */
  fxRate: number | null;
};

/**
 * Minor-unit exponent and latest FX rate for a currency, as used to price a
 * usage charge (`chargeUsage`) and a turn's minimum balance.
 */
export async function getCurrencyPricing(
  currencyCode: string
): Promise<CurrencyPricing> {
  const minorUnits = await getMinorUnits(currencyCode);
  const rate = await getLatestFxRate(currencyCode);
  return { minorUnits, fxRate: rate };
}

/**
 * Fetch fresh USD-based rates and store one row per active non-USD currency.
 * Never throws — on failure the last cached rows remain authoritative, so
 * callers (deduction) keep working off the most recent successful fetch.
 */
export async function refreshFxRates(): Promise<{
  updated: number;
  failed: boolean;
}> {
  try {
    const activeCurrencies = await db
      .select({ code: currency.code })
      .from(currency)
      .where(eq(currency.isActive, true));

    const response = await fetch(FX_API_URL, { cache: "no-store" });
    if (!response.ok) {
      return { updated: 0, failed: true };
    }

    const data = (await response.json()) as ErApiResponse;
    if (data.result !== "success") {
      return { updated: 0, failed: true };
    }

    const rows = activeCurrencies
      .filter((row) => row.code !== "USD" && data.rates[row.code] != null)
      .map((row) => ({
        baseCurrency: "USD",
        quoteCurrency: row.code,
        rate: data.rates[row.code].toString(),
        source: FX_SOURCE,
      }));

    if (rows.length > 0) {
      await db.insert(fxRate).values(rows);
    }

    return { updated: rows.length, failed: false };
  } catch {
    return { updated: 0, failed: true };
  }
}
