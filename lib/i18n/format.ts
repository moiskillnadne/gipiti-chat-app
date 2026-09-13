/**
 * Dictionary-agnostic message formatting. Deliberately imports no messages:
 * the root error boundaries (`app/error.tsx`, `app/global-error.tsx`) are part
 * of every route's client bundle, and pulling the full dictionary through them
 * shipped ~120 KB of JSON with the landing page.
 */
export type TranslationParams = Record<string, string | number>;

export type TranslateFn = (key: string, params?: TranslationParams) => string;

export type MessageDictionary = Record<string, unknown>;

const pluralRules = new Intl.PluralRules("ru");

const PLURAL_BLOCK = /^(\w+),\s*plural,\s*([\s\S]+)$/;
const VAR_BLOCK = /^(\w+)$/;
const WHITESPACE = /\s/;
const BRANCH_KEY_CHAR = /[\w=]/;
const HASH_TOKEN = /#/g;

function findMatchingClose(source: string, openIdx: number): number {
  let depth = 0;

  for (let i = openIdx; i < source.length; i++) {
    if (source[i] === "{") {
      depth++;
    } else if (source[i] === "}") {
      depth--;
      if (depth === 0) {
        return i;
      }
    }
  }

  return source.length - 1;
}

function pickPluralBranch(body: string, count: number): string {
  const category = pluralRules.select(count);
  const exactKey = `=${count}`;
  const branches: Record<string, string> = {};

  let i = 0;
  while (i < body.length) {
    while (i < body.length && WHITESPACE.test(body[i])) {
      i++;
    }

    const keyStart = i;
    while (i < body.length && BRANCH_KEY_CHAR.test(body[i])) {
      i++;
    }

    const key = body.slice(keyStart, i);
    if (!key) {
      break;
    }

    while (i < body.length && WHITESPACE.test(body[i])) {
      i++;
    }

    if (body[i] !== "{") {
      break;
    }

    const close = findMatchingClose(body, i);
    branches[key] = body.slice(i + 1, close);
    i = close + 1;
  }

  return branches[exactKey] ?? branches[category] ?? branches.other ?? "";
}

export function formatMessage(
  template: string,
  params: TranslationParams
): string {
  let result = "";
  let i = 0;

  while (i < template.length) {
    if (template[i] !== "{") {
      result += template[i];
      i++;
      continue;
    }

    const close = findMatchingClose(template, i);
    const block = template.slice(i + 1, close);

    const pluralMatch = block.match(PLURAL_BLOCK);
    if (pluralMatch) {
      const [, varName, pluralBody] = pluralMatch;
      const rawCount = params[varName];
      const count = typeof rawCount === "number" ? rawCount : Number(rawCount);

      if (Number.isFinite(count)) {
        const branch = pickPluralBranch(pluralBody, count);
        result += formatMessage(branch, params).replace(
          HASH_TOKEN,
          String(count)
        );
        i = close + 1;
        continue;
      }
    }

    const varMatch = block.match(VAR_BLOCK);
    if (varMatch) {
      const varName = varMatch[1];
      const value = params[varName];
      result += value === undefined ? `{${varName}}` : String(value);
      i = close + 1;
      continue;
    }

    result += template.slice(i, close + 1);
    i = close + 1;
  }

  return result;
}

function resolveKey(dictionary: MessageDictionary, path: string): unknown {
  let current: unknown = dictionary;

  for (const segment of path.split(".")) {
    if (!current || typeof current !== "object") {
      return;
    }
    current = (current as MessageDictionary)[segment];
  }

  return current;
}

/**
 * Builds a translate function over `dictionary`, optionally scoped to a
 * dotted `namespace`. Missing keys are logged and echoed back so a typo is
 * visible in the UI rather than rendering as empty text.
 */
export function createTranslator(
  dictionary: MessageDictionary,
  namespace?: string
): TranslateFn {
  return (key, params) => {
    const fullKey = namespace ? `${namespace}.${key}` : key;
    const value = resolveKey(dictionary, fullKey);

    if (typeof value !== "string") {
      if (typeof console !== "undefined") {
        console.warn(`[i18n] Missing translation: ${fullKey}`);
      }
      return fullKey;
    }

    return formatMessage(value, params ?? {});
  };
}
