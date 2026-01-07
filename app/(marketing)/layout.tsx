import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "GIPITI - AI-чат с ChatGPT, Gemini, Claude и Grok",
  description:
    "GIPITI — платформа с доступом к лучшим AI-моделям: ChatGPT 5.2, Gemini 3 Pro, Claude Opus 4.5 и Grok 4.1. Генерация текста, изображений, анализ документов.",
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

