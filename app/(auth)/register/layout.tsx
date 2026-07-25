import type { Metadata } from "next";
import { canonicalUrl } from "@/lib/seo/site";

export const metadata: Metadata = {
  title: "Регистрация",
  description:
    "Создайте аккаунт GIPITI и получите доступ к AI-чату с ChatGPT, Gemini, Claude и Grok. Дарим 200 ₽ каждому новому пользователю.",
  robots: { index: true, follow: true },
  alternates: { canonical: canonicalUrl("/register") },
  openGraph: {
    title: "Регистрация в GIPITI",
    description:
      "Создайте аккаунт и получите 200 ₽ на баланс для доступа к AI-чату",
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
