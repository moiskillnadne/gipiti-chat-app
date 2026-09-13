import errors from "../../messages/ru.errors.json" with { type: "json" };
import ru from "../../messages/ru.json" with { type: "json" };

/**
 * The `errors` namespace lives in its own file (`messages/ru.errors.json`) so
 * the root error boundaries can load just those strings through
 * `lib/i18n/errors.ts`; everything else is in `messages/ru.json`. Both are
 * merged here, so `useTranslations("errors")` keeps working everywhere.
 */
export const messages = { ...ru, errors } as Record<string, unknown>;

export type Messages = typeof ru & { errors: typeof errors };
