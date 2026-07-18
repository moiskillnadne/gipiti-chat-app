import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingNav } from "@/components/landing/landing-nav";
import { ModelLandingView } from "@/components/models/landing/model-landing-view";
import { ModelCard } from "@/components/models/model-card";
import { ModelsCta } from "@/components/models/models-cta";
import { ModelsTypeCrossLinks } from "@/components/models/models-type-cross-links";
import { ModelsTypeHero } from "@/components/models/models-type-hero";
import { toJsonLdString } from "@/lib/marketing/json-ld";
import {
  getModelLandingBySlug,
  type ModelLanding,
  modelLandings,
} from "@/lib/marketing/model-landings";
import {
  type CatalogSection,
  catalogSections,
  getModelsByCategory,
  getSectionBySlug,
} from "@/lib/marketing/models-catalog";

export const dynamic = "force-static";
export const revalidate = 3600;
export const dynamicParams = false;

type ModelsSlugPageProps = {
  params: Promise<{ slug: string }>;
};

/**
 * One dynamic segment serves both page kinds under /models/{slug}:
 * category pages (slug from `catalogSections`) and per-model landing
 * pages (slug from `modelLandings`).
 */
export const generateStaticParams = (): { slug: string }[] => [
  ...catalogSections.map((section) => ({ slug: section.slug })),
  ...modelLandings.map((landing) => ({ slug: landing.slug })),
];

export const generateMetadata = async ({
  params,
}: ModelsSlugPageProps): Promise<Metadata> => {
  const { slug } = await params;

  const section = getSectionBySlug(slug);
  if (section) {
    const canonicalUrl = `https://gipiti.ru/models/${section.slug}`;

    return {
      title: { absolute: section.typePage.metaTitle },
      description: section.typePage.metaDescription,
      alternates: { canonical: canonicalUrl },
      openGraph: {
        type: "website",
        title: section.typePage.metaTitle,
        description: section.typePage.metaDescription,
        url: canonicalUrl,
      },
    };
  }

  const landing = getModelLandingBySlug(slug);
  if (landing) {
    const canonicalUrl = `https://gipiti.ru/models/${landing.slug}`;

    return {
      title: { absolute: landing.metaTitle },
      description: landing.metaDescription,
      alternates: { canonical: canonicalUrl },
      openGraph: {
        type: "website",
        title: landing.metaTitle,
        description: landing.metaDescription,
        url: canonicalUrl,
      },
    };
  }

  return {};
};

const buildSectionBreadcrumbJsonLd = (section: CatalogSection) => ({
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
    {
      "@type": "ListItem",
      position: 3,
      name: section.categoryLabel,
      item: `https://gipiti.ru/models/${section.slug}`,
    },
  ],
});

const buildSectionModelsJsonLd = (section: CatalogSection) => {
  const models = getModelsByCategory(section.id);

  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: section.heading,
    numberOfItems: models.length,
    itemListElement: models.map((model, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: model.name,
      description: model.description,
    })),
  };
};

const buildLandingBreadcrumbJsonLd = (landing: ModelLanding) => ({
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
    {
      "@type": "ListItem",
      position: 3,
      name: landing.name,
      item: `https://gipiti.ru/models/${landing.slug}`,
    },
  ],
});

const buildLandingFaqJsonLd = (landing: ModelLanding) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: landing.faq.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
  })),
});

const ModelsCategoryPage = ({ section }: { section: CatalogSection }) => {
  const models = getModelsByCategory(section.id);

  return (
    <>
      <script
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD for SEO
        dangerouslySetInnerHTML={{
          __html: toJsonLdString(buildSectionBreadcrumbJsonLd(section)),
        }}
        type="application/ld+json"
      />
      <script
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD for SEO
        dangerouslySetInnerHTML={{
          __html: toJsonLdString(buildSectionModelsJsonLd(section)),
        }}
        type="application/ld+json"
      />

      <div className="min-h-screen bg-zinc-950">
        <LandingNav />
        <main className="pt-20">
          <ModelsTypeHero modelCount={models.length} section={section} />
          <div className="mx-auto max-w-6xl px-4 pt-10 pb-6">
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {models.map((model) => (
                <ModelCard key={model.modelId} model={model} />
              ))}
            </div>
          </div>
          <ModelsTypeCrossLinks currentCategory={section.id} />
          <ModelsCta />
        </main>
        <LandingFooter />
      </div>
    </>
  );
};

const ModelLandingPage = ({ landing }: { landing: ModelLanding }) => (
  <>
    <script
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD for SEO
      dangerouslySetInnerHTML={{
        __html: toJsonLdString(buildLandingBreadcrumbJsonLd(landing)),
      }}
      type="application/ld+json"
    />
    <script
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD for SEO
      dangerouslySetInnerHTML={{
        __html: toJsonLdString(buildLandingFaqJsonLd(landing)),
      }}
      type="application/ld+json"
    />

    <ModelLandingView landing={landing} />
  </>
);

export default async function ModelsSlugPage({ params }: ModelsSlugPageProps) {
  const { slug } = await params;

  const section = getSectionBySlug(slug);
  if (section) {
    return <ModelsCategoryPage section={section} />;
  }

  const landing = getModelLandingBySlug(slug);
  if (landing) {
    return <ModelLandingPage landing={landing} />;
  }

  notFound();
}
