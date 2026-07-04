import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingNav } from "@/components/landing/landing-nav";
import { ModelCard } from "@/components/models/model-card";
import { ModelsCta } from "@/components/models/models-cta";
import { ModelsTypeCrossLinks } from "@/components/models/models-type-cross-links";
import { ModelsTypeHero } from "@/components/models/models-type-hero";
import { toJsonLdString } from "@/lib/marketing/json-ld";
import {
  type CatalogSection,
  catalogSections,
  getModelsByCategory,
  getSectionBySlug,
} from "@/lib/marketing/models-catalog";

export const dynamic = "force-static";
export const revalidate = 3600;
export const dynamicParams = false;

type ModelsTypePageProps = {
  params: Promise<{ type: string }>;
};

export const generateStaticParams = (): { type: string }[] =>
  catalogSections.map((section) => ({ type: section.slug }));

export const generateMetadata = async ({
  params,
}: ModelsTypePageProps): Promise<Metadata> => {
  const { type } = await params;
  const section = getSectionBySlug(type);

  if (!section) {
    return {};
  }

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
};

const buildBreadcrumbJsonLd = (section: CatalogSection) => ({
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

const buildModelsJsonLd = (section: CatalogSection) => {
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

export default async function ModelsTypePage({ params }: ModelsTypePageProps) {
  const { type } = await params;
  const section = getSectionBySlug(type);

  if (!section) {
    notFound();
  }

  const models = getModelsByCategory(section.id);

  return (
    <>
      <script
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD for SEO
        dangerouslySetInnerHTML={{
          __html: toJsonLdString(buildBreadcrumbJsonLd(section)),
        }}
        type="application/ld+json"
      />
      <script
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD for SEO
        dangerouslySetInnerHTML={{
          __html: toJsonLdString(buildModelsJsonLd(section)),
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
}
