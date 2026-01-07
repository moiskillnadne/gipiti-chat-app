import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Регистрация",
  description:
    "Создайте аккаунт GIPITI и получите доступ к AI-чату с ChatGPT, Gemini, Claude и Grok. 3 дня бесплатного пробного периода.",
  robots: { index: true, follow: true },
  openGraph: {
    title: "Регистрация в GIPITI",
    description:
      "Создайте аккаунт и получите 3 дня бесплатного доступа к AI-чату",
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

