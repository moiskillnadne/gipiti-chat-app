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
  title: {
    absolute: "GIPITI - AI-чат с ChatGPT, Gemini, Claude, Grok, Flux и Recraft",
  },
  description:
    "GIPITI — платформа с доступом к 18+ AI-моделям от 6 провайдеров. Генерация текста, изображений и видео, генерация кода, анализ документов.",
  alternates: {
    canonical: "https://gipiti.ru",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "GIPITI",
  alternateName: ["Гипити", "гипити"],
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: "AI-чат платформа с доступом к 18+ моделям от 6 провайдеров",
  url: "https://gipiti.ru",
  inLanguage: "ru",
  offers: {
    "@type": "Offer",
    price: "999",
    priceCurrency: "RUB",
    availability: "https://schema.org/InStock",
  },
  featureList: [
    "Доступ к GPT-5.5",
    "Доступ к Gemini 3.1 Pro",
    "Доступ к Claude Opus 4.8",
    "Доступ к Grok 4.3",
    "Доступ к Flux и Recraft",
    "Генерация изображений",
    "Генерация видео",
    "Генерация кода",
    "Анализ документов",
    "Поиск в интернете",
    "100 ₽ на баланс при регистрации",
  ],
};

// WebSite + Organization graph. The `alternateName` aliases tell search engines
// that the Cyrillic spelling «Гипити» is the same brand as the Latin "GIPITI".
// TODO: add real social profile URLs to Organization.sameAs (VK, Telegram, etc.)
// once available — co-occurrence there reinforces the brand-alias association.
const siteJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://gipiti.ru/#website",
      name: "GIPITI",
      alternateName: ["Гипити", "гипити", "ГИПИТИ", "Gipiti", "GIPITI чат"],
      url: "https://gipiti.ru",
      inLanguage: "ru",
      publisher: { "@id": "https://gipiti.ru/#organization" },
    },
    {
      "@type": "Organization",
      "@id": "https://gipiti.ru/#organization",
      name: "GIPITI",
      alternateName: ["Гипити", "гипити"],
      url: "https://gipiti.ru",
      logo: "https://gipiti.ru/icon.png",
    },
  ],
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Что такое Гипити?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Гипити (GIPITI) — это российская платформа-агрегатор нейросетей. В одном чате доступны лучшие AI-модели: ChatGPT, Gemini, Claude и Grok, а также генерация изображений, видео и кода. Доступно из России, оплата в рублях.",
      },
    },
    {
      "@type": "Question",
      name: "Нужно ли платить, чтобы начать?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Нет. После регистрации мы дарим 100 ₽ на баланс, чтобы вы могли попробовать все функции платформы.",
      },
    },
    {
      "@type": "Question",
      name: "Какие платежные средства вы принимаете?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Мы принимаем Visa, MasterCard и МИР.",
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
        text: "Доступ ко всем 18+ AI-моделям от 6 провайдеров, генерация изображений и видео, генерация кода, анализ документов, поиск и режим рассуждений. Каждый месяц на баланс зачисляется 999 ₽.",
      },
    },
    {
      "@type": "Question",
      name: "Как работают лимиты?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Подписка зачисляет 999 ₽ на баланс каждый месяц. Баланс расходуется на запросы и ответы AI, его можно пополнить в любой момент.",
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }}
        id="site-json-ld"
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
