import type { Metadata } from "next";

import { WebMcpTools } from "@/components/landing/webmcp-tools";

export const metadata: Metadata = {
  title: {
    absolute: "GIPITI - AI-чат с ChatGPT, Gemini, Claude и Grok",
  },
  description:
    "GIPITI — платформа с доступом к лучшим AI-моделям: GPT-5.6, Gemini 3.1 Pro, Claude Opus 4.8 и Grok 4.5. Генерация текста, изображений, анализ документов. 100 ₽ на баланс при регистрации.",
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <style>{"html, body { background-color: #09090b; }"}</style>
      <WebMcpTools />
      {children}
    </>
  );
}
