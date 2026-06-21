const TRAILING_ERA = /\s*г\.?$/;

const russianDateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/**
 * Format an ISO date (`YYYY-MM-DD`) as Russian long form, e.g. "21 июня 2026".
 * The trailing " г." that Intl appends is stripped to match the design. Pure and
 * isomorphic so the preview byline matches the production byline.
 */
export function formatRussianDate(isoDate: string): string {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return isoDate;
  }
  return russianDateFormatter.format(parsed).replace(TRAILING_ERA, "");
}
