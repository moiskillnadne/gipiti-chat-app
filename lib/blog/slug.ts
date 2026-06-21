/**
 * Cyrillic → Latin transliteration map (GOST-ish, lossy on purpose) used to turn
 * a Russian article title into a URL-safe slug. Characters with no mapping (latin,
 * digits) pass through; soft/hard signs drop.
 */
const CYRILLIC_TRANSLITERATION: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "i",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "c",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

const NON_SLUG_CHARS = /[^a-z0-9]+/g;
const EDGE_HYPHENS = /^-+|-+$/g;
const MAX_SLUG_LENGTH = 80;

export function transliterate(input: string): string {
  let result = "";
  for (const character of input.toLowerCase()) {
    result += CYRILLIC_TRANSLITERATION[character] ?? character;
  }
  return result;
}

/**
 * Build a URL slug from a (typically Russian) title: transliterate, lowercase,
 * collapse every non-`[a-z0-9]` run to a single hyphen, trim edge hyphens, cap
 * length, then trim again in case the cap landed mid-word.
 */
export function slugify(title: string): string {
  return transliterate(title)
    .replace(NON_SLUG_CHARS, "-")
    .replace(EDGE_HYPHENS, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(EDGE_HYPHENS, "");
}
