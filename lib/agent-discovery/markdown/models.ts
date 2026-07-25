import {
  getModelLandingBySlug,
  type ModelLanding,
} from "@/lib/marketing/model-landings";
import {
  type CatalogSection,
  catalogSections,
  getModelsByCategory,
  getSectionBySlug,
} from "@/lib/marketing/models-catalog";

import { absoluteUrl } from "../constants";

/**
 * Markdown for `/models` and both kinds of `/models/{slug}` page — category
 * pages (`catalogSections`) and per-model landings (`modelLandings`) — mirroring
 * how `app/(marketing)/models/[slug]/page.tsx` resolves the segment.
 */

/** Strips the `**bold**` markers used in landing copy; Markdown keeps them as-is. */
const plain = (text: string): string => text.replace(/\*\*/g, "");

export const buildModelsIndexMarkdown = (): string =>
  [
    "# Каталог AI-моделей GIPITI",
    "",
    "Все модели доступны в одном чате по одной подписке, без VPN и с оплатой",
    "российскими картами.",
    "",
    `Страница: ${absoluteUrl("/models")}`,
    "",
    ...catalogSections.flatMap((section) => {
      const models = getModelsByCategory(section.id);

      return [
        `## ${section.heading}`,
        "",
        section.intro,
        "",
        ...models.map(
          (model) =>
            `- **${model.name}** (${model.vendor}) — ${model.description}`
        ),
        "",
        `Подробнее: ${absoluteUrl(`/models/${section.slug}`)}`,
        "",
      ];
    }),
  ].join("\n");

const buildSectionMarkdown = (section: CatalogSection): string => {
  const models = getModelsByCategory(section.id);

  return [
    `# ${section.typePage.h1Top} ${section.typePage.h1Gradient}`,
    "",
    section.typePage.sub,
    "",
    `Страница: ${absoluteUrl(`/models/${section.slug}`)}`,
    "",
    "## Модели",
    "",
    ...models.map(
      (model) => `- **${model.name}** (${model.vendor}) — ${model.description}`
    ),
    "",
    "## Другие категории",
    "",
    ...catalogSections
      .filter((other) => other.slug !== section.slug)
      .map(
        (other) => `- ${other.heading}: ${absoluteUrl(`/models/${other.slug}`)}`
      ),
    "",
  ].join("\n");
};

const buildLandingMarkdown = (landing: ModelLanding): string =>
  [
    `# ${landing.h1Top} ${landing.h1Gradient}`,
    "",
    // `badge` already leads with the vendor, e.g. "Anthropic · Сильнейшая модель".
    `**${landing.name}** — ${landing.badge}`,
    "",
    landing.sub,
    "",
    `Страница: ${absoluteUrl(`/models/${landing.slug}`)}`,
    "",
    "## Что умеет",
    "",
    ...landing.benefits.map(
      (benefit) => `- **${benefit.title}** — ${plain(benefit.text)}`
    ),
    "",
    "## Как начать",
    "",
    ...landing.steps.map(
      (step, index) => `${index + 1}. **${step.title}** — ${plain(step.text)}`
    ),
    "",
    "## Кому подходит",
    "",
    ...landing.audience.map(
      (card) => `- **${card.title}** — ${plain(card.text)}`
    ),
    "",
    "## Частые вопросы",
    "",
    ...landing.faq.flatMap((item) => [
      `### ${item.question}`,
      "",
      plain(item.answer),
      "",
    ]),
    "## Другие модели",
    "",
    ...landing.otherModels.map(
      (model) => `- ${model.name} (${model.tag}): ${absoluteUrl(model.href)}`
    ),
    "",
  ].join("\n");

/** Markdown for `/models/{slug}`, or `null` when the slug matches no page. */
export const buildModelsSlugMarkdown = (slug: string): string | null => {
  const section = getSectionBySlug(slug);
  if (section) {
    return buildSectionMarkdown(section);
  }

  const landing = getModelLandingBySlug(slug);
  if (landing) {
    return buildLandingMarkdown(landing);
  }

  return null;
};
