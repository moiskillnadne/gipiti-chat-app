import { messages } from "./dictionary";

type TranslationParams = Record<string, string | number>;

type TranslateFn = (key: string, params?: TranslationParams) => string;

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

function formatMessage(template: string, params: TranslationParams): string {
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

function resolveKey(path: string): unknown {
  let current: unknown = messages;

  for (const segment of path.split(".")) {
    if (!current || typeof current !== "object") {
      return;
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

function createTranslator(namespace?: string): TranslateFn {
  return (key, params) => {
    const fullKey = namespace ? `${namespace}.${key}` : key;
    const value = resolveKey(fullKey);

    if (typeof value !== "string") {
      if (typeof console !== "undefined") {
        console.warn(`[i18n] Missing translation: ${fullKey}`);
      }
      return fullKey;
    }

    return formatMessage(value, params ?? {});
  };
}

export function useTranslations(namespace?: string): TranslateFn {
  return createTranslator(namespace);
}

// biome-ignore lint/suspicious/useAwait: matches next-intl's async signature for server-side usage
export async function getTranslations(
  namespace?: string
): Promise<TranslateFn> {
  return createTranslator(namespace);
}
