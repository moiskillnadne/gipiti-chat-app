import type { Metadata } from "next";
import Script from "next/script";

import { BenefitsSection } from "@/components/landing/benefits-section";
import { CtaSection } from "@/components/landing/cta-section";
import { DemoShowcaseSection } from "@/components/landing/demo-showcase-section";
import { FaqSection } from "@/components/landing/faq-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { HeroSection } from "@/components/landing/hero-section";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingNav } from "@/components/landing/landing-nav";
import { ModelsSection } from "@/components/landing/models-section";
import { PainPointsSection } from "@/components/landing/pain-points-section";
import { PricingSection } from "@/components/landing/pricing-section";
import { TrustBar } from "@/components/landing/trust-bar";

export const metadata: Metadata = {
  title: "GIPITI - AI-чат с ChatGPT, Gemini, Claude и Grok",
  description:
    "GIPITI — платформа с доступом к лучшим AI-моделям: ChatGPT 5.2, Gemini 3 Pro, Claude Opus 4.6 и Grok 4.1. Генерация текста, изображений, анализ документов.",
  alternates: {
    canonical: "https://gipiti.ru",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "GIPITI",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: "AI-чат платформа с доступом к ChatGPT, Gemini, Claude и Grok",
  url: "https://gipiti.ru",
  offers: {
    "@type": "Offer",
    price: "1999",
    priceCurrency: "RUB",
  },
  featureList: [
    "Доступ к ChatGPT 5.2",
    "Доступ к Gemini 3 Pro",
    "Доступ к Claude Opus 4.6",
    "Доступ к Grok 4.1",
    "Генерация изображений",
    "Анализ документов",
    "Поиск в интернете",
  ],
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Как работает пробный период?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "После регистрации вы получаете 3 дня бесплатного доступа ко всем функциям платформы.",
      },
    },
    {
      "@type": "Question",
      name: "Какие платежные средства вы принимаете?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Мы принимаем Visa, MasterCard, МИР и СБП.",
      },
    },
    {
      "@type": "Question",
      name: "Могу ли я отменить подписку?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Да, вы можете отменить подписку в любой момент в настройках аккаунта.",
      },
    },
    {
      "@type": "Question",
      name: "Что входит в подписку?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Доступ ко всем AI-моделям, генерация изображений, анализ документов, поиск и режим рассуждений.",
      },
    },
    {
      "@type": "Question",
      name: "Как работают лимиты?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Подписка включает 3M токенов в месяц для всех функций.",
      },
    },
  ],
};

export default function LandingPage() {
  return (
    <>
      <Script
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD for SEO
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        id="json-ld"
        type="application/ld+json"
      />
      <Script
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD for SEO
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        id="faq-json-ld"
        type="application/ld+json"
      />

      <div className="min-h-screen bg-zinc-950">
        <LandingNav />
        <HeroSection />
        <PainPointsSection />
        <BenefitsSection />
        <TrustBar />
        <ModelsSection />
        <FeaturesSection />
        <DemoShowcaseSection />
        <HowItWorksSection />
        <PricingSection />
        <FaqSection />
        <CtaSection />
        <LandingFooter />
      </div>
    </>
  );
}
