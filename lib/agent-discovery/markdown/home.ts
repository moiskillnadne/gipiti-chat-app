import {
  homeBenefits,
  homeFaqItems,
  homeFeatures,
  pricingFeatures,
  SUBSCRIPTION_PRICE_RUB,
  WELCOME_BONUS_RUB,
} from "@/lib/marketing/landing-content";
import {
  catalogSections,
  getModelsByCategory,
} from "@/lib/marketing/models-catalog";

import { absoluteUrl } from "../constants";

/**
 * Markdown representation of `/`, served when the request asks for
 * `Accept: text/markdown`.
 *
 * Everything here is generated from the same modules the React sections render,
 * so the two views cannot drift.
 */

const INTRO = [
  "GIPITI (Гипити) — российская платформа-агрегатор нейросетей: доступ к 30+ AI-моделям",
  "от 10 провайдеров (OpenAI, Google, Anthropic, xAI, DeepSeek, Perplexity, Kling AI,",
  "ByteDance, BFL, Recraft) в одном чате. Работает без VPN, интерфейс на русском языке,",
  "оплата российскими картами в рублях.",
].join(" ");

const buildFeatures = (): string[] => [
  "## Возможности платформы",
  "",
  ...homeFeatures.map(
    (feature) => `- **${feature.title}** — ${feature.description}`
  ),
];

const buildBenefits = (): string[] => [
  "## Чем GIPITI отличается",
  "",
  ...homeBenefits.map(
    (benefit) => `- **${benefit.title}** — ${benefit.description}`
  ),
];

const buildCatalog = (): string[] => [
  "## Доступные модели",
  "",
  `Полный каталог: ${absoluteUrl("/models")}`,
  "",
  ...catalogSections.flatMap((section) => {
    const models = getModelsByCategory(section.id);

    return [
      `### ${section.heading}`,
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
];

const buildPricing = (): string[] => [
  "## Тариф",
  "",
  `**${SUBSCRIPTION_PRICE_RUB} ₽ в месяц.** Подписка зачисляет ${SUBSCRIPTION_PRICE_RUB} ₽ на баланс каждый месяц;`,
  "баланс расходуется на запросы к моделям и пополняется в любой момент.",
  `При регистрации на баланс начисляется ${WELCOME_BONUS_RUB} ₽ — этого достаточно, чтобы попробовать`,
  "все функции без оплаты.",
  "",
  "В подписку входит:",
  "",
  ...pricingFeatures.map((feature) => `- ${feature}`),
];

const buildFaq = (): string[] => [
  "## Частые вопросы",
  "",
  ...homeFaqItems.flatMap((item) => [
    `### ${item.question}`,
    "",
    item.answer,
    "",
  ]),
];

const buildLinks = (): string[] => [
  "## Разделы сайта",
  "",
  `- Каталог моделей: ${absoluteUrl("/models")}`,
  `- Блог: ${absoluteUrl("/blog")}`,
  `- Вход: ${absoluteUrl("/login")}`,
  `- Регистрация: ${absoluteUrl("/register")}`,
  `- Публичная оферта: ${absoluteUrl("/legal/offer")}`,
  `- Политика конфиденциальности: ${absoluteUrl("/legal/privacy")}`,
  `- Поддержка: ${absoluteUrl("/legal/support")}`,
];

export const buildHomeMarkdown = (): string =>
  [
    "# GIPITI — AI-чат с ChatGPT, Gemini, Claude, Grok, Flux и Recraft",
    "",
    INTRO,
    "",
    `Сайт: ${absoluteUrl("/")}`,
    "",
    ...buildFeatures(),
    "",
    ...buildBenefits(),
    "",
    ...buildCatalog(),
    ...buildPricing(),
    "",
    ...buildFaq(),
    ...buildLinks(),
    "",
  ].join("\n");
