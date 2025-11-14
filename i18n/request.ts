import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { defaultLocale, LOCALE_COOKIE_NAME, type Locale } from "./config";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const locale =
    (cookieStore.get(LOCALE_COOKIE_NAME)?.value as Locale) || defaultLocale;

  console.log("locale", locale);
  console.log("messages loaded");

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
