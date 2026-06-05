import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Регистрация",
  description:
    "Создайте аккаунт GIPITI и получите доступ к AI-чату с ChatGPT, Gemini, Claude и Grok. Дарим 100 ₽ на баланс при регистрации.",
  robots: { index: true, follow: true },
  openGraph: {
    title: "Регистрация в GIPITI",
    description:
      "Создайте аккаунт и получите 100 ₽ на баланс для доступа к AI-чату",
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
