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

export type CatalogTypePage = {
  /** First (plain) line of the H1 */
  h1Top: string;
  /** Second (gradient) line of the H1 */
  h1Gradient: string;
  sub: string;
  metaTitle: string;
  metaDescription: string;
};

export type CatalogSection = {
  id: CatalogCategory;
  /** Path segment of the type landing page: /models/{slug} */
  slug: string;
  heading: string;
  intro: string;
  categoryLabel: string;
  typePage: CatalogTypePage;
};

export const catalogSections: CatalogSection[] = [
  {
    id: "text",
    slug: "text",
    heading: "Модели для работы с текстом",
    intro: "Чат, тексты, анализ документов и рассуждения.",
    categoryLabel: "Текст",
    typePage: {
      h1Top: "Нейросети для работы",
      h1Gradient: "с текстом на русском",
      sub: "GPT-5.6, Claude Opus 4.8, Gemini 3.1 Pro, DeepSeek V4, Perplexity Sonar и другие — пишите тексты, анализируйте документы и решайте рабочие задачи на русском языке. Без VPN, оплата российскими картами.",
      metaTitle:
        "Нейросети для работы с текстом — GPT-5.6, Claude, Gemini, DeepSeek, Perplexity | GIPITI",
      metaDescription:
        "Лучшие текстовые AI-модели в одном чате: GPT-5.6, Claude Opus 4.8, Gemini 3.1 Pro, DeepSeek V4, Perplexity Sonar и Grok 4.5. Без VPN, на русском, оплата российскими картами.",
    },
  },
  {
    id: "images",
    slug: "image-generation",
    heading: "Модели для генерации изображений",
    intro: "Генерация и редактирование картинок по описанию.",
    categoryLabel: "Изображения",
    typePage: {
      h1Top: "Нейросети для генерации",
      h1Gradient: "изображений на русском",
      sub: "Nano Banana, GPT Image, Flux, Seedream, Recraft и другие — создавайте и редактируйте изображения по описанию на русском языке. Без VPN, оплата российскими картами.",
      metaTitle:
        "Нейросети для генерации изображений — Nano Banana, GPT Image, Flux, Seedream | GIPITI",
      metaDescription:
        "Генерация и редактирование изображений по описанию: Nano Banana, GPT Image 2, Flux 2 Max, Seedream, Recraft и Grok Imagine в одной подписке. Без VPN, оплата российскими картами.",
    },
  },
  {
    id: "video",
    slug: "video-generation",
    heading: "Модели для генерации видео",
    intro: "Видеоролики по текстовому промпту или из изображения.",
    categoryLabel: "Видео",
    typePage: {
      h1Top: "Нейросети для генерации",
      h1Gradient: "видео на русском",
      sub: "Veo 3.1, Kling 3.0, Seedance 2.0 и Grok Imagine Video — создавайте видеоролики по текстовому описанию или из готового изображения. Без VPN, оплата российскими картами.",
      metaTitle:
        "Нейросети для генерации видео — Veo 3.1, Kling 3.0, Seedance 2.0 | GIPITI",
      metaDescription:
        "Генерация видео по текстовому промпту или из изображения: Veo 3.1 со звуком, Kling 3.0, Seedance 2.0 и Grok Imagine Video. Без VPN, на русском, оплата российскими картами.",
    },
  },
  {
    id: "code",
    slug: "code",
    heading: "Модели для генерации кода",
    intro: "Написание, отладка и объяснение кода.",
    categoryLabel: "Код",
    typePage: {
      h1Top: "Нейросети для генерации",
      h1Gradient: "кода на русском",
      sub: "GPT-Codex 5.3 и другие модели — пишите, отлаживайте и рефакторьте код, разбирайтесь в чужих проектах. Без VPN, оплата российскими картами.",
      metaTitle: "Нейросети для генерации кода — GPT-Codex 5.3 | GIPITI",
      metaDescription:
        "Генерация, отладка и объяснение кода с GPT-Codex 5.3 и другими AI-моделями в одном чате. Без VPN, на русском, оплата российскими картами.",
    },
  },
];

export const catalogModels: CatalogModel[] = [
  {
    modelId: "gpt-5.6-sol",
    name: "GPT-5.6 Sol",
    vendor: "OpenAI",
    provider: "openai",
    category: "text",
    description:
      "Флагман серии GPT-5.6: сложные агентные задачи, программирование и глубокие рассуждения.",
    tag: "Новинка",
    hue: 250,
  },
  {
    modelId: "gpt-5.6-terra",
    name: "GPT-5.6 Terra",
    vendor: "OpenAI",
    provider: "openai",
    category: "text",
    description:
      "Сбалансированная модель GPT-5.6 для повседневной работы — уровень прошлого флагмана вдвое дешевле.",
    tag: "Новинка",
    hue: 250,
  },
  {
    modelId: "gpt-5.6-luna",
    name: "GPT-5.6 Luna",
    vendor: "OpenAI",
    provider: "openai",
    category: "text",
    description:
      "Быстрая и доступная модель серии GPT-5.6 — сильные возможности по минимальной цене.",
    tag: "Новинка",
    hue: 250,
  },
  {
    modelId: "gpt-5.5",
    name: "GPT-5.5",
    vendor: "OpenAI",
    provider: "openai",
    category: "text",
    description:
      "Проверенный флагман OpenAI прошлого поколения: сложные рассуждения, длинные тексты, работа с документами.",
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
    modelId: "sonnet-5",
    name: "Claude Sonnet 5",
    vendor: "Anthropic",
    provider: "anthropic",
    category: "text",
    description:
      "Новое поколение сбалансированной модели Anthropic — код, аналитика и повседневные задачи.",
    tag: "Новинка",
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
    modelId: "gemini-3.5-flash",
    name: "Gemini 3.5 Flash",
    vendor: "Google",
    provider: "google",
    category: "text",
    description:
      "Быстрая модель Google для повседневных задач — мгновенные ответы с рассуждениями по низкой цене.",
    tag: "Новинка",
    hue: 210,
  },
  {
    modelId: "grok-4.5",
    name: "Grok 4.5",
    vendor: "xAI",
    provider: "xai",
    category: "text",
    description:
      "Новейшая модель xAI: передовые результаты в программировании, аналитике и STEM-задачах.",
    tag: "Новинка",
    hue: 0,
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
    modelId: "deepseek-v4-pro",
    name: "DeepSeek V4 Pro",
    vendor: "DeepSeek",
    provider: "deepseek",
    category: "text",
    description:
      "Флагман DeepSeek: глубокие рассуждения и контекст до миллиона токенов.",
    tag: "Новинка",
    hue: 250,
  },
  {
    modelId: "deepseek-v4-flash",
    name: "DeepSeek V4 Flash",
    vendor: "DeepSeek",
    provider: "deepseek",
    category: "text",
    description:
      "Быстрая и доступная версия DeepSeek V4 для повседневных задач.",
    tag: "Новинка",
    hue: 250,
  },
  {
    modelId: "sonar",
    name: "Sonar",
    vendor: "Perplexity",
    provider: "perplexity",
    category: "text",
    description:
      "Быстрые ответы со встроенным поиском в интернете и ссылками на источники.",
    hue: 185,
  },
  {
    modelId: "sonar-pro",
    name: "Sonar Pro",
    vendor: "Perplexity",
    provider: "perplexity",
    category: "text",
    description:
      "Продвинутый поиск Perplexity: сложные запросы, подробные ответы с источниками.",
    hue: 185,
  },
  {
    modelId: "sonar-reasoning-pro",
    name: "Sonar Reasoning Pro",
    vendor: "Perplexity",
    provider: "perplexity",
    category: "text",
    description:
      "Рассуждающая модель с поиском: пошаговый анализ и ответы со ссылками на источники.",
    hue: 185,
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
    modelId: "gemini-3.1-flash-lite-image",
    name: "Nano Banana Lite",
    vendor: "Google",
    provider: "google",
    category: "images",
    description:
      "Самая быстрая и недорогая генерация изображений от Google — для набросков и итераций.",
    tag: "Новинка",
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
    modelId: "seedream-5.0-lite",
    name: "Seedream 5.0 Lite",
    vendor: "ByteDance",
    provider: "bytedance",
    category: "images",
    description:
      "Новейшая модель ByteDance: понимает сложные промпты и учитывает актуальную информацию из сети.",
    tag: "Новинка",
    hue: 200,
  },
  {
    modelId: "seedream-4.5",
    name: "Seedream 4.5",
    vendor: "ByteDance",
    provider: "bytedance",
    category: "images",
    description:
      "Точное редактирование с сохранением деталей, света и цвета; сильная работа с текстом на картинке.",
    hue: 200,
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
    modelId: "kling-v3.0-t2v",
    name: "Kling 3.0",
    vendor: "Kling AI",
    provider: "klingai",
    category: "video",
    description:
      "Флагманская модель Kling: кинематографичное видео с озвучкой по текстовому описанию.",
    tag: "Новинка",
    hue: 145,
  },
  {
    modelId: "kling-v3.0-i2v",
    name: "Kling 3.0 Image-to-Video",
    vendor: "Kling AI",
    provider: "klingai",
    category: "video",
    description:
      "Оживляет ваше изображение: видео со звуком из готовой картинки и промпта.",
    tag: "Новинка",
    hue: 145,
  },
  {
    modelId: "kling-v2.6-t2v",
    name: "Kling 2.6",
    vendor: "Kling AI",
    provider: "klingai",
    category: "video",
    description:
      "Видео с нативным звуком по текстовому промпту: речь, эффекты и эмбиент за один проход.",
    hue: 145,
  },
  {
    modelId: "kling-v2.5-turbo-t2v",
    name: "Kling 2.5 Turbo",
    vendor: "Kling AI",
    provider: "klingai",
    category: "video",
    description: "Быстрая и доступная генерация видео по текстовому описанию.",
    hue: 145,
  },
  {
    modelId: "seedance-2.0",
    name: "Seedance 2.0",
    vendor: "ByteDance",
    provider: "bytedance",
    category: "video",
    description:
      "Мультимодальная генерация видео со звуком: по тексту или из изображения, реалистичная физика движения.",
    tag: "Новинка",
    hue: 200,
  },
  {
    modelId: "seedance-2.0-fast",
    name: "Seedance 2.0 Fast",
    vendor: "ByteDance",
    provider: "bytedance",
    category: "video",
    description:
      "Быстрая версия Seedance 2.0: те же возможности, ниже цена и время ожидания.",
    hue: 200,
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

export const getSectionBySlug = (slug: string): CatalogSection | undefined =>
  catalogSections.find((section) => section.slug === slug);

/** Russian pluralization: 1 модель, 2–4 модели, 5+ моделей */
export const pluralizeModels = (count: number): string => {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return `${count} модель`;
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} модели`;
  }

  return `${count} моделей`;
};
