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
      sub: "GPT-6.1, Claude Opus 5.5, Gemini 4 Argon, Grok 4.7, Kimi K3.1 Pro, Qwen 3.8, Meta Muse, Mistral Large 4, DeepSeek V4 и другие — пишите тексты, анализируйте документы и решайте рабочие задачи на русском языке. Без VPN, оплата российскими картами.",
      metaTitle:
        "Нейросети для работы с текстом — GPT-6, Claude, Gemini, Grok, Qwen | GIPITI",
      metaDescription:
        "Текстовые AI-модели в одном чате: GPT-6.1, Claude Opus 5.5, Gemini 4 Argon, Grok 4.7, Kimi K3.1 Pro, Meta Muse и Mistral Large 4. Без VPN, оплата картами РФ.",
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
      sub: "Nano Banana 2.1, GPT Image 2.5, Flux 3 Image, Seedream 5.0 Pro, MAI-Image 2.6, Grok Imagine 2.0 и Recraft — создавайте и редактируйте изображения по описанию на русском языке. Без VPN, оплата российскими картами.",
      metaTitle:
        "Нейросети для генерации изображений — Nano Banana, GPT Image, Flux, Seedream | GIPITI",
      metaDescription:
        "Генерация и редактирование изображений по описанию: Nano Banana, GPT Image 2.5, Flux 2 Max, Seedream 5.0 Pro, Recraft и Grok Imagine 2.0 в одной подписке. Без VPN, оплата российскими картами.",
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
      sub: "Veo 3.1, Kling 3.0, Seedance 2.5, Wan 3.0, Grok Imagine Video 1.5 и Flux 3 Video — создавайте видеоролики по текстовому описанию или из готового изображения. Без VPN, оплата российскими картами.",
      metaTitle:
        "Нейросети для генерации видео — Veo 3.1, Kling 3.0, Seedance 2.5, Flux 3 | GIPITI",
      metaDescription:
        "Видео по промпту или из картинки: Veo 3.1 со звуком, Wan 3.0 со звуком, Kling 3.0, Seedance 2.5 и Grok Imagine Video. Без VPN, на русском.",
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
    modelId: "gpt-6.1-sol",
    name: "GPT-6.1 Sol",
    vendor: "OpenAI",
    provider: "openai",
    category: "text",
    description:
      "Обновлённый флагман GPT-6: сложный код, агентные задачи и контекст на миллион токенов по прежней цене.",
    tag: "Новинка",
    hue: 250,
  },
  {
    modelId: "gpt-6.1-terra",
    name: "GPT-6.1 Terra",
    vendor: "OpenAI",
    provider: "openai",
    category: "text",
    description:
      "Быстрая и экономичная модель OpenAI: живые тексты, разбор изображений и контекст около миллиона токенов.",
    tag: "Новинка",
    hue: 250,
  },
  {
    modelId: "gpt-6-astra",
    name: "GPT-6 Astra",
    vendor: "OpenAI",
    provider: "openai",
    category: "text",
    description:
      "Самая мощная модель OpenAI: сложные рассуждения, код, исследования и работа с документами.",
    tag: "Новинка",
    hue: 250,
  },
  {
    modelId: "gpt-6-sol",
    name: "GPT-6 Sol",
    vendor: "OpenAI",
    provider: "openai",
    category: "text",
    description:
      "Флагман нового поколения GPT-6: сложный код, агентные задачи и контекст на миллион токенов.",
    tag: "Новинка",
    hue: 250,
  },
  {
    modelId: "gpt-6-luna",
    name: "GPT-6 Luna",
    vendor: "OpenAI",
    provider: "openai",
    category: "text",
    description:
      "Быстрая и экономичная модель GPT-6 — рассуждения для частых и объёмных задач по минимальной цене.",
    tag: "Новинка",
    hue: 250,
  },
  {
    modelId: "gpt-5.6-sol",
    name: "GPT-5.6 Sol",
    vendor: "OpenAI",
    provider: "openai",
    category: "text",
    description:
      "Флагман серии GPT-5.6: сложные агентные задачи, программирование и глубокие рассуждения.",
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
    hue: 250,
  },
  {
    modelId: "gpt-5.6-luna",
    name: "GPT-5.6 Luna",
    vendor: "OpenAI",
    provider: "openai",
    category: "text",
    description:
      "Быстрая и доступная модель серии GPT-5.6 — сильные возможности по низкой цене.",
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
    modelId: "fable-5.1",
    name: "Claude Fable 5.1",
    vendor: "Anthropic",
    provider: "anthropic",
    category: "text",
    description:
      "Премиальная модель Anthropic: многочасовые задачи по коду, работа со знаниями и исследования.",
    tag: "Новинка",
    hue: 30,
  },
  {
    modelId: "opus-5.5",
    name: "Claude Opus 5.5",
    vendor: "Anthropic",
    provider: "anthropic",
    category: "text",
    description:
      "Мощная модель Anthropic: длинные агентные задачи, программирование и понятные отчёты о ходе работы.",
    tag: "Новинка",
    hue: 30,
  },
  {
    modelId: "opus-5",
    name: "Claude Opus 5",
    vendor: "Anthropic",
    provider: "anthropic",
    category: "text",
    description:
      "Предыдущий флагман Anthropic: глубокая аналитика, эталонная редактура и большой контекст.",
    hue: 30,
  },
  {
    modelId: "opus-4.8",
    name: "Claude Opus 4.8",
    vendor: "Anthropic",
    provider: "anthropic",
    category: "text",
    description:
      "Проверенный Opus прошлого поколения — аналитика, редактура и большой контекст.",
    hue: 30,
  },
  {
    modelId: "sonnet-5.5",
    name: "Claude Sonnet 5.5",
    vendor: "Anthropic",
    provider: "anthropic",
    category: "text",
    description:
      "Новейший Sonnet: код, документы, таблицы и повседневные задачи — сильнее Sonnet 5 по той же цене.",
    tag: "Новинка",
    hue: 30,
  },
  {
    modelId: "sonnet-5",
    name: "Claude Sonnet 5",
    vendor: "Anthropic",
    provider: "anthropic",
    category: "text",
    description:
      "Сбалансированная модель Anthropic прошлого поколения — код, аналитика и повседневные задачи.",
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
    modelId: "haiku-5.5",
    name: "Claude Haiku 5.5",
    vendor: "Anthropic",
    provider: "anthropic",
    category: "text",
    description:
      "Новейший Haiku: быстрые ответы с рассуждениями, файлы и изображения — самая доступная модель Claude.",
    tag: "Новинка",
    hue: 30,
  },
  {
    modelId: "gemini-4-argon",
    name: "Gemini 4 Argon",
    vendor: "Google",
    provider: "google",
    category: "text",
    description:
      "Модель Google линейки Gemini 4: код, агентные задачи и рассуждения с контекстом на миллион токенов.",
    tag: "Новинка",
    hue: 210,
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
    modelId: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    vendor: "Google",
    provider: "google",
    category: "text",
    description:
      "Новейшая быстрая модель Google: уровень Pro в агентных задачах и коде при высокой скорости.",
    tag: "Новинка",
    hue: 210,
  },
  {
    modelId: "gemini-3.7-flash",
    name: "Gemini 3.7 Flash",
    vendor: "Google",
    provider: "google",
    category: "text",
    description:
      "Быстрая модель Google прошлого поколения: уровень Pro в агентных задачах и коде при высокой скорости.",
    hue: 210,
  },
  {
    modelId: "gemini-3.6-flash",
    name: "Gemini 3.6 Flash",
    vendor: "Google",
    provider: "google",
    category: "text",
    description:
      "Проверенная быстрая модель Google: код и агентные задачи при низком расходе токенов.",
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
    hue: 210,
  },
  {
    modelId: "gemini-3.5-flash-lite",
    name: "Gemini 3.5 Flash Lite",
    vendor: "Google",
    provider: "google",
    category: "text",
    description:
      "Самая экономичная модель Google с рассуждениями — для простых, частых и объёмных задач.",
    tag: "Новинка",
    hue: 210,
  },
  {
    modelId: "grok-4.7",
    name: "Grok 4.7",
    vendor: "xAI",
    provider: "xai",
    category: "text",
    description:
      "Новейшая модель xAI: многочасовые задачи по коду и документам, самопроверка и большой контекст.",
    tag: "Новинка",
    hue: 0,
  },
  {
    modelId: "grok-4.6",
    name: "Grok 4.6",
    vendor: "xAI",
    provider: "xai",
    category: "text",
    description:
      "Предыдущий флагман xAI: длинные агентные задачи, программирование и работа с большим контекстом.",
    hue: 0,
  },
  {
    modelId: "grok-4.5",
    name: "Grok 4.5",
    vendor: "xAI",
    provider: "xai",
    category: "text",
    description:
      "Проверенный флагман xAI прошлого поколения: программирование, аналитика и STEM-задачи.",
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
    modelId: "deepseek-v4.1-flash-1017",
    name: "DeepSeek V4.1 Flash 1017",
    vendor: "DeepSeek",
    provider: "deepseek",
    category: "text",
    description:
      "Октябрьское обновление быстрой модели DeepSeek: точнее в рассуждениях, коде и изображениях, ответы короче.",
    tag: "Новинка",
    hue: 250,
  },
  {
    modelId: "deepseek-v4.1-flash",
    name: "DeepSeek V4.1 Flash",
    vendor: "DeepSeek",
    provider: "deepseek",
    category: "text",
    description:
      "Новая быстрая модель DeepSeek: рассуждения, понимание изображений и низкая цена запроса.",
    tag: "Новинка",
    hue: 250,
  },
  {
    modelId: "deepseek-v4-pro",
    name: "DeepSeek V4 Pro",
    vendor: "DeepSeek",
    provider: "deepseek",
    category: "text",
    description:
      "Флагман DeepSeek: глубокие рассуждения и контекст до миллиона токенов.",
    hue: 250,
  },
  {
    modelId: "deepseek-v4-flash",
    name: "DeepSeek V4 Flash",
    vendor: "DeepSeek",
    provider: "deepseek",
    category: "text",
    description:
      "Быстрая и доступная версия DeepSeek V4 прошлого поколения для повседневных задач.",
    hue: 250,
  },
  {
    modelId: "kimi-k3.1-pro",
    name: "Kimi K3.1 Pro",
    vendor: "Moonshot AI",
    provider: "moonshotai",
    category: "text",
    description:
      "Флагман Moonshot AI: рассуждает перед каждым ответом, понимает изображения и держит около миллиона токенов.",
    tag: "Новинка",
    hue: 295,
  },
  {
    modelId: "kimi-k3-fast",
    name: "Kimi K3 Fast",
    vendor: "Moonshot AI",
    provider: "moonshotai",
    category: "text",
    description:
      "Быстрый флагман Moonshot AI: длинные задачи по программированию и контекст до миллиона токенов.",
    tag: "Новинка",
    hue: 295,
  },
  {
    modelId: "qwen3.8-max-prime",
    name: "Qwen 3.8 Max Prime",
    vendor: "Alibaba",
    provider: "alibaba",
    category: "text",
    description:
      "Производительная версия флагмана Qwen: контекст на миллион токенов и ответы до 131 тысячи токенов.",
    tag: "Новинка",
    hue: 65,
  },
  {
    modelId: "qwen3.8-max",
    name: "Qwen 3.8 Max",
    vendor: "Alibaba",
    provider: "alibaba",
    category: "text",
    description:
      "Флагман Alibaba: программирование, длинные документы и профессиональные задачи от начала до конца.",
    tag: "Новинка",
    hue: 65,
  },
  {
    modelId: "qwen3.8-flash",
    name: "Qwen 3.8 Flash",
    vendor: "Alibaba",
    provider: "alibaba",
    category: "text",
    description:
      "Быстрая модель Qwen нового поколения: рассуждения, изображения и контекст около миллиона токенов по низкой цене.",
    tag: "Новинка",
    hue: 65,
  },
  {
    modelId: "qwen3.7-flash",
    name: "Qwen 3.7 Flash",
    vendor: "Alibaba",
    provider: "alibaba",
    category: "text",
    description:
      "Быстрая мультимодальная модель Alibaba прошлого поколения: текст, изображения и агентные сценарии по низкой цене.",
    hue: 65,
  },
  {
    modelId: "muse-wonder-1.0",
    name: "Muse Wonder 1.0",
    vendor: "Meta",
    provider: "meta",
    category: "text",
    description:
      "Передовая рассуждающая модель Meta для сложных многошаговых задач и контекста около миллиона токенов.",
    tag: "Новинка",
    hue: 230,
  },
  {
    modelId: "muse-spark-1.3",
    name: "Muse Spark 1.3",
    vendor: "Meta",
    provider: "meta",
    category: "text",
    description:
      "Мультимодальная модель Meta: читает фото и скриншоты, рассуждает и тратит меньше токенов, чем версия 1.2.",
    tag: "Новинка",
    hue: 230,
  },
  {
    modelId: "mistral-large-4",
    name: "Mistral Large 4",
    vendor: "Mistral AI",
    provider: "mistral",
    category: "text",
    description:
      "Открытый мультимодальный флагман Mistral AI: рассуждения, текст и изображения любых пропорций.",
    tag: "Новинка",
    hue: 40,
  },
  {
    modelId: "glm-5.3",
    name: "GLM-5.3",
    vendor: "Z.ai",
    provider: "zai",
    category: "text",
    description:
      "Модель Z.ai для сложной разработки, многошаговых агентных задач и поиска уязвимостей в коде.",
    tag: "Новинка",
    hue: 150,
  },
  {
    modelId: "minimax-m3.1-flash",
    name: "MiniMax M3.1 Flash",
    vendor: "MiniMax",
    provider: "minimax",
    category: "text",
    description:
      "Недорогая рассуждающая модель MiniMax: код, агентные задачи и понимание изображений.",
    tag: "Новинка",
    hue: 340,
  },
  {
    modelId: "mimo-v2.6-pro",
    name: "MiMo v2.6 Pro",
    vendor: "Xiaomi",
    provider: "xiaomi",
    category: "text",
    description:
      "Флагман Xiaomi: пошаговые рассуждения, понимание изображений и контекст около миллиона токенов.",
    tag: "Новинка",
    hue: 15,
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
    modelId: "nano-banana-2.1",
    name: "Nano Banana 2.1",
    vendor: "Google",
    provider: "google",
    category: "images",
    description:
      "Новое поколение Nano Banana: генерация и точечное редактирование изображений в 1K, 2K и 4K.",
    tag: "Новинка",
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
    modelId: "gpt-image-2.5-flare",
    name: "GPT Image 2.5 Flare",
    vendor: "OpenAI",
    provider: "openai",
    category: "images",
    description:
      "Новая модель OpenAI для быстрой повседневной генерации: посты, карточки товаров, иллюстрации.",
    tag: "Новинка",
    hue: 250,
  },
  {
    modelId: "gpt-image-2.5-sunburst",
    name: "GPT Image 2.5 Sunburst",
    vendor: "OpenAI",
    provider: "openai",
    category: "images",
    description:
      "Новая модель OpenAI с упором на точное редактирование: правки без потери остальной сцены.",
    tag: "Новинка",
    hue: 250,
  },
  {
    modelId: "gpt-image-2",
    name: "GPT Image 2",
    vendor: "OpenAI",
    provider: "openai",
    category: "images",
    description:
      "Проверенная модель OpenAI прошлого поколения: фотореализм и точное редактирование.",
    hue: 250,
  },
  {
    modelId: "flux-3-image",
    name: "Flux 3 Image",
    vendor: "BFL",
    provider: "bfl",
    category: "images",
    description:
      "Новый флагман Black Forest Labs: генерация и точечное редактирование изображений в одной модели.",
    tag: "Новинка",
    hue: 315,
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
    modelId: "grok-imagine-image-2.0",
    name: "Grok Imagine 2.0",
    vendor: "xAI",
    provider: "xai",
    category: "images",
    description:
      "Новое поколение генератора изображений xAI: выше детализация и точнее следование описанию.",
    tag: "Новинка",
    hue: 0,
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
    modelId: "seedream-5.0-pro",
    name: "Seedream 5.0 Pro",
    vendor: "ByteDance",
    provider: "bytedance",
    category: "images",
    description:
      "Старшая модель ByteDance: фотореалистичные сцены, предметная съёмка и точное редактирование.",
    tag: "Новинка",
    hue: 200,
  },
  {
    modelId: "seedream-5.0-lite",
    name: "Seedream 5.0 Lite",
    vendor: "ByteDance",
    provider: "bytedance",
    category: "images",
    description:
      "Быстрая и недорогая модель линейки Seedream 5.0 — для набросков и перебора идей.",
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
    modelId: "mai-image-2.6",
    name: "MAI-Image 2.6",
    vendor: "Microsoft",
    provider: "microsoft",
    category: "images",
    description:
      "Модель Microsoft AI с упором на качество: генерация и точное редактирование объектов, надписей и композиции.",
    tag: "Новинка",
    hue: 120,
  },
  {
    modelId: "mai-image-2.6-flash",
    name: "MAI-Image 2.6 Flash",
    vendor: "Microsoft",
    provider: "microsoft",
    category: "images",
    description:
      "Быстрая и более дешёвая версия MAI-Image 2.6: те же генерация и правки изображений.",
    tag: "Новинка",
    hue: 120,
  },
  {
    modelId: "veo-3.1",
    name: "Veo 3.1",
    vendor: "Google",
    provider: "google",
    category: "video",
    description:
      "Видео со звуком по текстовому описанию — до 8 секунд, кинематографичное качество.",
    tag: "Новинка",
    hue: 170,
  },
  {
    modelId: "flux-3-video",
    name: "Flux 3 Video",
    vendor: "BFL",
    provider: "bfl",
    category: "video",
    description:
      "Видеомодель Black Forest Labs: ролики со звуком по описанию или из готового изображения.",
    tag: "Новинка",
    hue: 315,
  },
  {
    modelId: "wan-v3.0-video",
    name: "Wan 3.0",
    vendor: "Alibaba",
    provider: "alibaba",
    category: "video",
    description:
      "Видеомодель Alibaba: ролики со звуком по текстовому описанию, пять форматов кадра.",
    tag: "Новинка",
    hue: 65,
  },
  {
    modelId: "grok-imagine-video",
    name: "Grok Imagine Video",
    vendor: "xAI",
    provider: "xai",
    category: "video",
    description:
      "Версия 1.5: оживляет готовое изображение в короткий ролик со звуком.",
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
    modelId: "seedance-2.5",
    name: "Seedance 2.5",
    vendor: "ByteDance",
    provider: "bytedance",
    category: "video",
    description:
      "Новое поколение видеомодели ByteDance: ролики со звуком по тексту или из картинки, точный контроль сцены.",
    tag: "Новинка",
    hue: 200,
  },
  {
    modelId: "seedance-2.0",
    name: "Seedance 2.0",
    vendor: "ByteDance",
    provider: "bytedance",
    category: "video",
    description:
      "Генерация видео со звуком по тексту или из изображения, реалистичная физика движения.",
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

/**
 * Catalog size rounded down to the nearest ten, for copy like "50+ моделей".
 * Derived rather than hardcoded so it stays truthful between releases — the
 * hand-written "18+" drifted while the catalog grew past fifty.
 */
export const catalogModelCountFloor: number =
  Math.floor(catalogModels.length / 10) * 10;

/** Number of distinct providers behind the catalog models. */
export const catalogProviderCount: number = new Set(
  catalogModels.map((model) => model.provider)
).size;

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
