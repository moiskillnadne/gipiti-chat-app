/**
 * Pure helpers for the `save-plan` Claude Code hook: turning an accepted plan
 * into a dated, slugged Markdown file under `docs/plans/`. No I/O here so the
 * naming rules stay unit-testable.
 */

export type PlanMetadata = {
  date: string;
  branch: string | null;
  sessionId: string | null;
};

const MAX_SLUG_LENGTH = 50;
const FALLBACK_SLUG = "plan";

/** Leading "Plan:" / "План:" style prefixes that add nothing to a filename. */
const TITLE_PREFIX_PATTERN = /^(implementation\s+plan|plan|план)\s*[:—–-]\s*/i;
const FIRST_H1_PATTERN = /^#\s+(.+)$/m;

const CYRILLIC_TO_LATIN: Record<string, string> = {
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
  й: "y",
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
  х: "kh",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "shch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

const transliterate = (text: string): string =>
  Array.from(
    text,
    (character) => CYRILLIC_TO_LATIN[character] ?? character
  ).join("");

/** First `# Heading` of the plan, without a redundant "Plan:" prefix. */
export const extractPlanTitle = (plan: string): string | null => {
  const heading = plan.match(FIRST_H1_PATTERN)?.at(1)?.trim();
  if (!heading) {
    return null;
  }

  return heading.replace(TITLE_PREFIX_PATTERN, "").trim() || heading;
};

/** kebab-case ASCII slug; Russian titles are transliterated rather than dropped. */
export const slugifyTitle = (title: string | null): string => {
  if (!title) {
    return FALLBACK_SLUG;
  }

  const slug = transliterate(title.toLowerCase())
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/^-+|-+$/g, "");

  return slug || FALLBACK_SLUG;
};

/**
 * `YYYY-MM-DD-<slug>.md`, suffixed `-2`, `-3`, … when a plan with the same name
 * already exists (e.g. a plan re-approved after revisions on the same day).
 */
export const buildPlanFileName = (
  date: string,
  slug: string,
  existingFileNames: ReadonlySet<string>
): string => {
  const baseName = `${date}-${slug}`;
  let candidate = `${baseName}.md`;

  for (let suffix = 2; existingFileNames.has(candidate); suffix += 1) {
    candidate = `${baseName}-${suffix}.md`;
  }

  return candidate;
};

/** Prepends YAML frontmatter so the plan history is greppable by date/branch/status. */
export const renderPlanDocument = (
  plan: string,
  metadata: PlanMetadata
): string => {
  const frontmatterLines = [
    "---",
    `date: ${metadata.date}`,
    "status: accepted",
    metadata.branch ? `branch: ${metadata.branch}` : null,
    metadata.sessionId ? `session: ${metadata.sessionId}` : null,
    "---",
  ].filter((line): line is string => line !== null);

  return `${frontmatterLines.join("\n")}\n\n${plan.trim()}\n`;
};
