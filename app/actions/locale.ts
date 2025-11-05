"use server";

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { auth } from "@/app/(auth)/auth";
import { LOCALE_COOKIE_NAME, type Locale, locales } from "@/i18n/config";
import { db } from "@/lib/db/queries";
import { user } from "@/lib/db/schema";

export async function setUserLocale(
  locale: Locale
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!locales.includes(locale)) {
      return { success: false, error: "Invalid locale" };
    }

    const cookieStore = await cookies();
    cookieStore.set(LOCALE_COOKIE_NAME, locale, {
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
      sameSite: "lax",
    });

    const session = await auth();
    if (session?.user?.id) {
      await db
        .update(user)
        .set({
          preferredLanguage: locale,
          updatedAt: new Date(),
        })
        .where(eq(user.id, session.user.id));
    }

    return { success: true };
  } catch (error) {
    console.error("Failed to set user locale:", error);
    return { success: false, error: "Failed to update locale preference" };
  }
}
