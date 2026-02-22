import type { Metadata } from "next";

import { LandingThemeOverride } from "@/components/landing/landing-theme-override";

export const metadata: Metadata = {
  title: "GIPITI - AI-чат с ChatGPT, Gemini, Claude и Grok",
  description:
    "GIPITI — платформа с доступом к лучшим AI-моделям: ChatGPT 5.2, Gemini 3.1 Pro, Claude Opus 4.6 и Grok 4.1. Генерация текста, изображений, анализ документов.",
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <style>{"html, body { background-color: #09090b; }"}</style>
      <LandingThemeOverride />
      {children}
    </>
  );
}
