import { messages } from "./dictionary";
import { createTranslator, type TranslateFn } from "./format";

export type { TranslateFn } from "./format";

export function useTranslations(namespace?: string): TranslateFn {
  return createTranslator(messages, namespace);
}

// biome-ignore lint/suspicious/useAwait: matches next-intl's async signature for server-side usage
export async function getTranslations(
  namespace?: string
): Promise<TranslateFn> {
  return createTranslator(messages, namespace);
}
