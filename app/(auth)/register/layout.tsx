import type { Metadata } from "next";
import {
  NEW_USER_BONUS_SHORT_RU,
  NEW_USER_BONUS_TERMS_RU,
} from "@/lib/marketing/landing-content";
import { canonicalUrl } from "@/lib/seo/site";

export const metadata: Metadata = {
  title: "Регистрация",
  description: `Создайте аккаунт GIPITI и получите доступ к AI-чату с ChatGPT, Gemini, Claude и Grok. ${NEW_USER_BONUS_SHORT_RU}.`,
  robots: { index: true, follow: true },
  alternates: { canonical: canonicalUrl("/register") },
  openGraph: {
    title: "Регистрация в GIPITI",
    description: `Создайте аккаунт для доступа к AI-чату: ${NEW_USER_BONUS_TERMS_RU}`,
    type: "website",
  },
};

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
