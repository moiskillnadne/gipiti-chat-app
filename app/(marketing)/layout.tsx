import type { Metadata } from "next";

import { WebMcpTools } from "@/components/landing/webmcp-tools";
import { NEW_USER_BONUS_SHORT_RU } from "@/lib/marketing/landing-content";

export const metadata: Metadata = {
  title: {
    absolute: "GIPITI - AI-чат с ChatGPT, Gemini, Claude и Grok",
  },
  description: `GIPITI — платформа с доступом к лучшим AI-моделям: GPT-6, Gemini 3.1 Pro, Claude Opus 5.5 и Grok 4.7. Генерация текста, изображений, анализ документов. ${NEW_USER_BONUS_SHORT_RU}.`,
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* The marketing site is dark (zinc-950): a light focus ring keeps the global
          :focus-visible outline above 3:1 there without touching the light app. */}
      <style>
        {
          "html, body { background-color: #09090b; } :root { --ring: var(--paper); }"
        }
      </style>
      <WebMcpTools />
      {children}
    </>
  );
}
