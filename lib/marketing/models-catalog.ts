/**
 * Curated marketing copy for the public /models catalog page.
 *
 * Each entry is keyed to a real model id from `lib/ai/models.ts` so future
 * per-model landing pages can link back to the registry. Copy is hardcoded
 * Russian, matching the rest of the marketing surface (components/landing).
 */

import type { ModelProvider } from "@/lib/ai/models";

export type CatalogCategory = "text" | "images" | "video" | "code";

export type CatalogModel = {
  modelId: string;
  name: string;
  vendor: string;
  provider: ModelProvider;
  category: CatalogCategory;
  description: string;
  tag?: "Популярная" | "Новинка";
  /** oklch hue driving the card avatar gradient */
  hue: number;
};

export type CatalogSection = {
  id: CatalogCategory;
  heading: string;
  intro: string;
  categoryLabel: string;
};

export const catalogSections: CatalogSection[] = [
  {
    id: "text",
    heading: "Модели для работы с текстом",
    intro: "Чат, тексты, анализ документов и рассуждения.",
    categoryLabel: "Текст",
  },
  {
    id: "images",
    heading: "Модели для генерации изображений",
    intro: "Генерация и редактирование картинок по описанию.",
    categoryLabel: "Изображения",
  },
  {
    id: "video",
    heading: "Модели для генерации видео",
    intro: "Видеоролики по текстовому промпту или из изображения.",
    categoryLabel: "Видео",
  },
  {
    id: "code",
    heading: "Модели для генерации кода",
    intro: "Написание, отладка и объяснение кода.",
    categoryLabel: "Код",
  },
];

export const catalogModels: CatalogModel[] = [
  {
    modelId: "gpt-5.5",
    name: "GPT-5.5",
    vendor: "OpenAI",
    provider: "openai",
    category: "text",
    description:
      "Флагман OpenAI: сложные рассуждения, длинные тексты, работа с документами.",
    tag: "Популярная",
    hue: 250,
  },
  {
    modelId: "opus-4.8",
    name: "Claude Opus 4.8",
    vendor: "Anthropic",
    provider: "anthropic",
    category: "text",
    description:
      "Сильнейшая модель для аналитики, редактуры и работы с большим контекстом.",
    hue: 30,
  },
  {
    modelId: "sonnet-4.6",
    name: "Claude Sonnet 4.6",
    vendor: "Anthropic",
    provider: "anthropic",
    category: "text",
    description:
      "Быстрые ответы уровня флагмана — для повседневных задач и переписки.",
    hue: 30,
  },
  {
    modelId: "gemini-3.1-pro",
    name: "Gemini 3.1 Pro",
    vendor: "Google",
    provider: "google",
    category: "text",
    description:
      "Мультимодальная модель Google: текст, изображения и документы в одном чате.",
    hue: 210,
  },
  {
    modelId: "grok-4.3",
    name: "Grok 4.3",
    vendor: "xAI",
    provider: "xai",
    category: "text",
    description: "Модель xAI с доступом к актуальным данным и свободным тоном.",
    hue: 0,
  },
  {
    modelId: "gemini-3.1-flash-image",
    name: "Nano Banana",
    vendor: "Google",
    provider: "google",
    category: "images",
    description:
      "Генерация и редактирование изображений по-русски: фон, стиль, персонажи.",
    tag: "Популярная",
    hue: 90,
  },
  {
    modelId: "gemini-3-pro-image",
    name: "Nano Banana Pro",
    vendor: "Google",
    provider: "google",
    category: "images",
    description:
      "Продвинутая версия: точнее следует промпту, лучше работает с текстом на картинке.",
    hue: 90,
  },
  {
    modelId: "gpt-image-2",
    name: "GPT Image 2",
    vendor: "OpenAI",
    provider: "openai",
    category: "images",
    description:
      "Фотореалистичные генерации и точное редактирование от OpenAI.",
    hue: 250,
  },
  {
    modelId: "flux-2-max",
    name: "Flux 2 Max",
    vendor: "BFL",
    provider: "bfl",
    category: "images",
    description:
      "Художественные стили, высокая детализация, отличная типографика.",
    hue: 315,
  },
  {
    modelId: "recraft-v4.1-pro",
    name: "Recraft v4.1 Pro",
    vendor: "Recraft",
    provider: "recraft",
    category: "images",
    description: "Векторная графика, логотипы, иконки и брендовые иллюстрации.",
    hue: 275,
  },
  {
    modelId: "grok-imagine-image",
    name: "Grok Imagine",
    vendor: "xAI",
    provider: "xai",
    category: "images",
    description: "Быстрые генерации изображений и коротких видео от xAI.",
    hue: 0,
  },
  {
    modelId: "veo-3.1",
    name: "Veo 3.1",
    vendor: "Google",
    provider: "google",
    category: "video",
    description:
      "Видео со звуком по текстовому описанию — до 60 секунд, кинематографичное качество.",
    tag: "Новинка",
    hue: 170,
  },
  {
    modelId: "grok-imagine-video",
    name: "Grok Imagine Video",
    vendor: "xAI",
    provider: "xai",
    category: "video",
    description: "Короткие видеоролики по промпту или из готового изображения.",
    hue: 0,
  },
  {
    modelId: "gpt-codex-5.3",
    name: "GPT-Codex 5.3",
    vendor: "OpenAI",
    provider: "openai",
    category: "code",
    description:
      "Генерация и рефакторинг кода, отладка и объяснение чужих проектов.",
    hue: 250,
  },
];

export const getModelsByCategory = (
  category: CatalogCategory
): CatalogModel[] =>
  catalogModels.filter((model) => model.category === category);
