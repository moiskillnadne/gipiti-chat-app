import errors from "../../messages/ru.errors.json" with { type: "json" };
import { createTranslator, type TranslateFn } from "./format";

/**
 * Translator for the `errors` namespace only. Use it in the root error
 * boundaries (`app/error.tsx`, `app/global-error.tsx`), which are bundled into
 * every route: `useTranslations` would drag the whole dictionary along.
 */
export function useErrorTranslations(): TranslateFn {
  return createTranslator(errors);
}
