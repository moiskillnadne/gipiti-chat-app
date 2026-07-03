import type { Metadata } from "next";

import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingNav } from "@/components/landing/landing-nav";
import { ModelsAnchorNav } from "@/components/models/models-anchor-nav";
import { ModelsCatalogSections } from "@/components/models/models-catalog-sections";
import { ModelsCta } from "@/components/models/models-cta";
import { ModelsHero } from "@/components/models/models-hero";
import { catalogModels } from "@/lib/marketing/models-catalog";

export const dynamic = "force-static";
export const revalidate = 3600;

export const metadata: Metadata = {
  title: {
    absolute: "Все AI-модели в одном чате — GPT, Claude, Gemini, Grok | GIPITI",
  },
  description:
    "Каталог моделей GIPITI: GPT-5.5, Claude Opus 4.8, Gemini 3.1 Pro, Grok 4.3, Nano Banana, Veo 3.1 и другие. Текст, изображения, видео и код — без VPN, оплата российскими картами.",
  alternates: { canonical: "https://gipiti.ru/models" },
  openGraph: {
    type: "website",
    title: "Все AI-модели в одном чате — GIPITI",
    description:
      "GPT, Claude, Gemini, Grok и модели генерации изображений и видео — в одной подписке, без VPN.",
    url: "https://gipiti.ru/models",
  },
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Главная",
      item: "https://gipiti.ru",
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Модели",
      item: "https://gipiti.ru/models",
    },
  ],
};

const modelsJsonLd = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "AI-модели в GIPITI",
  numberOfItems: catalogModels.length,
  itemListElement: catalogModels.map((model, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: model.name,
    description: model.description,
  })),
};

/**
 * Escapes `<` so the JSON-LD payload cannot terminate the script tag early.
 * Native <script> (not next/script) so the markup is server-rendered into the
 * static HTML for SEO — same approach as the blog article page.
 */
const toJsonLdString = (value: object): string =>
  JSON.stringify(value).replace(/</g, "\\u003c");

export default function ModelsCatalogPage() {
  return (
    <>
      <script
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD for SEO
        dangerouslySetInnerHTML={{ __html: toJsonLdString(breadcrumbJsonLd) }}
        type="application/ld+json"
      />
      <script
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD for SEO
        dangerouslySetInnerHTML={{ __html: toJsonLdString(modelsJsonLd) }}
        type="application/ld+json"
      />

      <div className="min-h-screen bg-zinc-950">
        <LandingNav />
        <main className="pt-20">
          <ModelsHero />
          <ModelsAnchorNav />
          <ModelsCatalogSections />
          <ModelsCta />
        </main>
        <LandingFooter />
      </div>
    </>
  );
}
