import { getRequestConfig } from "next-intl/server";
import type { Locale } from "./config";

// Temporarily force Russian locale for all users
// To restore cookie-based detection, uncomment the cookie logic below

export default getRequestConfig(async () => {
  // Temporarily force Russian locale
  const locale: Locale = "ru";

  // Original cookie-based detection (commented out for temporary Russian-only mode):
  // import { cookies } from "next/headers";
  // import { defaultLocale, LOCALE_COOKIE_NAME } from "./config";
  // const cookieStore = await cookies();
  // const locale = (cookieStore.get(LOCALE_COOKIE_NAME)?.value as Locale) || defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
