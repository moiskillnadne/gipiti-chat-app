import { dump, load } from "js-yaml";

export type ParsedMarkdownFile = {
  data: Record<string, unknown>;
  content: string;
};

// A leading YAML frontmatter block delimited by `---` fences, then the body.
const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
const LEADING_NEWLINES = /^\r?\n+/;

/**
 * Split a raw `.md` file into its frontmatter object and Markdown body. Pure and
 * isomorphic (js-yaml runs in the browser too), so the server loader and the
 * client preview tool parse files identically. Returns empty data when there is
 * no frontmatter block.
 */
export function parseFrontmatter(raw: string): ParsedMarkdownFile {
  const match = raw.match(FRONTMATTER_PATTERN);

  if (!match) {
    return { data: {}, content: raw };
  }

  const [, yamlBlock, body] = match;
  const loaded = load(yamlBlock);
  const data =
    loaded && typeof loaded === "object"
      ? (loaded as Record<string, unknown>)
      : {};

  return { data, content: body.replace(LEADING_NEWLINES, "") };
}

/**
 * Serialize validated frontmatter + body back into a `.md` file. Used by the
 * preview tool's export so the file the author sends matches exactly what the
 * server loader expects.
 */
export function serializeFrontmatter(
  data: Record<string, unknown>,
  content: string
): string {
  // js-yaml throws on `undefined` values — drop optional fields that are unset.
  const defined = Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined)
  );

  const yamlBlock = dump(defined, {
    lineWidth: -1,
    sortKeys: false,
    quoteStyle: "auto",
  });

  return `---\n${yamlBlock}---\n\n${content.trim()}\n`;
}
