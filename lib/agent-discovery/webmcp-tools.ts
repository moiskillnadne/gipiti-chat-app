import {
  pricingFeatures,
  SUBSCRIPTION_PRICE_RUB,
  WELCOME_BONUS_RUB,
} from "@/lib/marketing/landing-content";
import {
  type CatalogCategory,
  type CatalogModel,
  catalogModels,
  catalogSections,
} from "@/lib/marketing/models-catalog";

import { absoluteUrl } from "./constants";

/**
 * Tools this site offers to an in-browser agent over WebMCP.
 *
 * All three are read-only lookups over catalog data that is already in the page
 * bundle: no network calls, no session, no side effects. Anything that spends a
 * user's balance or changes their account stays out — an agent should not be
 * able to trigger that from a marketing page.
 */

const CATEGORIES: CatalogCategory[] = ["text", "images", "video", "code"];

const text = (value: string): WebMcpToolResult => ({
  content: [{ type: "text", text: value }],
});

const describeModel = (model: CatalogModel): string =>
  `- ${model.name} (${model.vendor}, ${model.category}) — ${model.description}`;

const isCategory = (value: unknown): value is CatalogCategory =>
  typeof value === "string" && CATEGORIES.includes(value as CatalogCategory);

const listModels = (input: WebMcpToolInput): WebMcpToolResult => {
  const { category } = input;
  const models = isCategory(category)
    ? catalogModels.filter((model) => model.category === category)
    : catalogModels;

  if (models.length === 0) {
    return text("Модели для этой категории не найдены.");
  }

  const heading = isCategory(category)
    ? `Модели GIPITI в категории «${category}» (${models.length}):`
    : `Все модели GIPITI (${models.length}):`;

  return text(
    [
      heading,
      ...models.map(describeModel),
      "",
      `Каталог: ${absoluteUrl("/models")}`,
    ].join("\n")
  );
};

const searchModels = (input: WebMcpToolInput): WebMcpToolResult => {
  const { query } = input;

  if (typeof query !== "string" || query.trim().length === 0) {
    return text("Укажите поисковый запрос в параметре query.");
  }

  const needle = query.trim().toLowerCase();
  const matches = catalogModels.filter((model) =>
    [model.name, model.vendor, model.description]
      .join(" ")
      .toLowerCase()
      .includes(needle)
  );

  if (matches.length === 0) {
    return text(
      `По запросу «${query}» ничего не найдено. Полный каталог: ${absoluteUrl("/models")}`
    );
  }

  return text(
    [`Найдено моделей: ${matches.length}`, ...matches.map(describeModel)].join(
      "\n"
    )
  );
};

const getPricing = (): WebMcpToolResult =>
  text(
    [
      `Подписка GIPITI: ${SUBSCRIPTION_PRICE_RUB} ₽ в месяц.`,
      `Каждый месяц на баланс зачисляется ${SUBSCRIPTION_PRICE_RUB} ₽; списание идёт за фактические запросы к моделям, а не за их количество.`,
      `При регистрации начисляется ${WELCOME_BONUS_RUB} ₽ — попробовать можно без оплаты.`,
      "Баланс можно пополнить отдельно в любой момент.",
      "Оплата картами Visa, MasterCard и МИР в рублях.",
      "",
      "В подписку входит:",
      ...pricingFeatures.map((feature) => `- ${feature}`),
      "",
      `Подробнее: ${absoluteUrl("/#pricing")}`,
    ].join("\n")
  );

export const webMcpTools: WebMcpTool[] = [
  {
    name: "list_gipiti_models",
    description:
      "Перечислить AI-модели, доступные на GIPITI, опционально по категории задач.",
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: CATEGORIES,
          description: `Категория: ${catalogSections
            .map((section) => `${section.id} — ${section.categoryLabel}`)
            .join("; ")}. Без неё возвращаются все модели.`,
        },
      },
      additionalProperties: false,
    },
    execute: (input) => Promise.resolve(listModels(input)),
  },
  {
    name: "search_gipiti_models",
    description:
      "Найти модель на GIPITI по названию, вендору или описанию возможностей.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Поисковый запрос, например «видео» или «Claude».",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
    execute: (input) => Promise.resolve(searchModels(input)),
  },
  {
    name: "get_gipiti_pricing",
    description:
      "Получить условия подписки GIPITI: стоимость, как расходуется баланс и что входит.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    execute: () => Promise.resolve(getPricing()),
  },
];
