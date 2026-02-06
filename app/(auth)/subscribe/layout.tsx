import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Тарифы",
  description:
    "Выберите подходящий тариф GIPITI: от 1 999 ₽/месяц. Доступ к ChatGPT 5.2, Gemini 3 Pro, Claude Opus 4.6 и Grok 4.1. Генерация текста и изображений.",
  robots: { index: true, follow: true },
  openGraph: {
    title: "Тарифы GIPITI - выберите подходящий план",
    description: "Тарифы от 1 999 ₽/месяц. 3 дня бесплатного пробного периода.",
    type: "website",
  },
};

export default function SubscribeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
