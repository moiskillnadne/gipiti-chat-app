export type Locale = "en" | "ru";

export const locales: Locale[] = ["en", "ru"];
// Temporarily forced to Russian - was "en"
export const defaultLocale: Locale = "ru";

export const localeNames: Record<Locale, string> = {
  en: "English",
  ru: "Русский",
};

export const localeFlags: Record<Locale, string> = {
  en: "🇺🇸",
  ru: "🇷🇺",
};

export const LOCALE_COOKIE_NAME = "NEXT_LOCALE";
