import { USAGE_MARKUP } from "./constants";

/**
 * Convert a provider cost in USD into the user's currency, in minor units.
 * charge = usdCost × fxRate × markup. Rounded up so we never undercharge on
 * sub-minor-unit amounts.
 */
export function usdToMinorUnits({
  usdCost,
  fxRate,
  minorUnits,
  markup = USAGE_MARKUP,
}: {
  usdCost: number;
  fxRate: number;
  minorUnits: number;
  markup?: number;
}): number {
  const majorAmount = usdCost * fxRate * markup;
  const factor = 10 ** minorUnits;
  return Math.ceil(majorAmount * factor);
}

/**
 * Convert a major-unit amount (e.g. 100 RUB) into minor units (e.g. 10000).
 */
export function majorToMinorUnits(major: number, minorUnits: number): number {
  return Math.round(major * 10 ** minorUnits);
}

/**
 * Convert minor units back to a major-unit number (e.g. 10000 → 100.0).
 */
export function minorToMajorUnits(minor: number, minorUnits: number): number {
  return minor / 10 ** minorUnits;
}

/**
 * Format a minor-unit amount as a localized currency string.
 */
export function formatCurrency(
  minorAmount: number,
  currencyCode: string,
  minorUnits = 2
): string {
  const major = minorToMajorUnits(minorAmount, minorUnits);
  try {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: minorUnits,
    }).format(major);
  } catch {
    return `${major.toFixed(minorUnits)} ${currencyCode}`;
  }
}

/**
 * The currency symbol for a code (₽, $, ₸, …) via Intl, falling back to the
 * code itself when the runtime can't resolve it.
 */
export function currencySymbol(currencyCode: string): string {
  try {
    const parts = new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: currencyCode,
    }).formatToParts(0);
    return (
      parts.find((part) => part.type === "currency")?.value ?? currencyCode
    );
  } catch {
    return currencyCode;
  }
}

export type SplitMoney = {
  sign: string;
  whole: string;
  frac: string;
};

/**
 * Split a minor-unit amount into sign / grouped whole part / fractional part so
 * the balance hero can render the fraction at a smaller size. ru-RU grouping
 * (spaces). Integer math only — no float-rounding surprises.
 */
export function splitMoney(minorAmount: number, minorUnits = 2): SplitMoney {
  const negative = minorAmount < 0;
  const absMinor = Math.abs(Math.trunc(minorAmount));
  const factor = 10 ** minorUnits;
  const whole = Math.floor(absMinor / factor);
  const fracValue = absMinor % factor;
  const wholeStr = whole.toLocaleString("ru-RU").replace(/ /g, " ");
  const frac =
    minorUnits > 0 ? String(fracValue).padStart(minorUnits, "0") : "";
  return { sign: negative ? "−" : "", whole: wholeStr, frac };
}
