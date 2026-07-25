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
import { PainPointsSection } from "@/components/landing/pain-points-section";
import { PricingSection } from "@/components/landing/pricing-section";
import { TrustBar } from "@/components/landing/trust-bar";
import { homeFaqItems } from "@/lib/marketing/landing-content";

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
    "Доступ к GPT-5.6",
    "Доступ к Gemini 3.1 Pro",
    "Доступ к Claude Opus 5",
    "Доступ к Grok 4.5",
    "Доступ к Flux и Recraft",
    "Генерация изображений",
    "Генерация видео",
    "Генерация кода",
    "Анализ документов",
    "Поиск в интернете",
    "200 ₽ на баланс каждому новому пользователю",
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

// Built from the same source as the rendered accordion (`FaqSection`). Google
// requires FAQPage structured data to match the visible answers, so this must
// never be a hand-maintained paraphrase — it drifted before, and the grant
// amounts inside the answers now come from the billing constants.
const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: homeFaqItems.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
  })),
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
