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
