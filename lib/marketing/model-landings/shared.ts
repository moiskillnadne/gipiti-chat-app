/**
 * Copy blocks reused across model landings: slugs for cross-linking, shared
 * FAQ items, benefits, audience cards and the cross-catalog chip list.
 *
 * Image and video landings pull their own shared blocks from `media-shared.ts`
 * but reuse the slugs and the section copy defined here.
 */

import type {
  LandingAudienceCard,
  LandingBenefit,
  LandingFaqItem,
  LandingKind,
  LandingModelChip,
  LandingStep,
} from "./types";

// Text landings
export const SOL_SLUG = "gpt-5-6-sol";
export const TERRA_SLUG = "gpt-5-6-terra";
export const LUNA_SLUG = "gpt-5-6-luna";
export const GPT55_SLUG = "gpt-5-5";
export const CODEX_SLUG = "gpt-codex-5-3";
export const OPUS_SLUG = "claude-opus-4-8";
export const SONNET_SLUG = "claude-sonnet-5";
export const SONNET_46_SLUG = "claude-sonnet-4-6";
export const GEMINI_PRO_SLUG = "gemini-3-1-pro";
export const GEMINI_FLASH_SLUG = "gemini-3-5-flash";
export const SONAR_SLUG = "perplexity-sonar";
export const SONAR_PRO_SLUG = "perplexity-sonar-pro";
export const SONAR_REASONING_SLUG = "perplexity-sonar-reasoning-pro";
export const GROK_SLUG = "grok-4-5";
export const GROK_43_SLUG = "grok-4-3";
export const DEEPSEEK_SLUG = "deepseek-v4-pro";
export const DEEPSEEK_FLASH_SLUG = "deepseek-v4-flash";

// Image landings
export const NANO_BANANA_SLUG = "nano-banana";
export const NANO_BANANA_LITE_SLUG = "nano-banana-lite";
export const NANO_BANANA_PRO_SLUG = "nano-banana-pro";
export const GPT_IMAGE_SLUG = "gpt-image-2";
export const FLUX_SLUG = "flux-2-max";
export const RECRAFT_SLUG = "recraft-v4-1-pro";
export const GROK_IMAGINE_SLUG = "grok-imagine";
export const SEEDREAM_LITE_SLUG = "seedream-5-0-lite";
export const SEEDREAM_45_SLUG = "seedream-4-5";

// Video landings
export const VEO_SLUG = "veo-3-1";
export const GROK_IMAGINE_VIDEO_SLUG = "grok-imagine-video";
export const KLING_30_SLUG = "kling-3-0";
export const KLING_30_I2V_SLUG = "kling-3-0-image-to-video";
export const KLING_26_SLUG = "kling-2-6";
export const KLING_25_TURBO_SLUG = "kling-2-5-turbo";
export const SEEDANCE_SLUG = "seedance-2-0";
export const SEEDANCE_FAST_SLUG = "seedance-2-0-fast";

/** Section sub-headings and composer hints, chosen by what the model produces. */
export const sectionCopy: Record<
  LandingKind,
  {
    benefitsSub: string;
    stepsSub: string;
    audienceSub: string;
    composerPlaceholder: (modelName: string) => string;
  }
> = {
  text: {
    benefitsSub:
      "Чем модель выделяется и за что её выбирают для работы с текстом",
    stepsSub: "Первый ответ — через минуту после регистрации",
    audienceSub:
      "Инструмент для всех, кто каждый день работает с текстом и документами",
    composerPlaceholder: (modelName) => `Спросите ${modelName} о чём угодно…`,
  },
  image: {
    benefitsSub:
      "Чем модель выделяется и за что её выбирают для генерации изображений",
    stepsSub: "Первое изображение — через минуту после регистрации",
    audienceSub:
      "Инструмент для всех, кому картинки нужны каждый день, а не раз в квартал",
    composerPlaceholder: () => "Опишите изображение на русском…",
  },
  video: {
    benefitsSub:
      "Чем модель выделяется и за что её выбирают для генерации видео",
    stepsSub: "Первый ролик — через несколько минут после регистрации",
    audienceSub:
      "Инструмент для всех, кому нужно видео без съёмочной группы и монтажа",
    composerPlaceholder: () => "Опишите сцену на русском…",
  },
};

const DEFAULT_ASK_STEP_TEXT =
  "Текстом на русском — или прикрепите документ, ссылку или код.";

export const buildSteps = (
  name: string,
  askStepText: string = DEFAULT_ASK_STEP_TEXT
): LandingStep[] => [
  {
    title: "Зарегистрируйтесь",
    text: "Аккаунт за 30 секунд — нужен только email. Дарим 200 ₽ каждому новому пользователю.",
  },
  {
    title: `Выберите ${name}`,
    text: "Переключитесь на модель в списке — в один клик, как и на любую из 30+.",
  },
  {
    title: "Задайте вопрос",
    text: askStepText,
  },
  {
    title: "Получите ответ",
    text: "И продолжайте диалог в том же чате — модель помнит контекст разговора.",
  },
];

export const vpnFaq: LandingFaqItem = {
  question: "Нужен ли VPN или зарубежная карта?",
  answer:
    "Нет. GIPITI работает из России без ограничений, оплата — картами МИР, Visa, MasterCard или через СБП.",
};

export const priceFaq: LandingFaqItem = {
  question: "Сколько это стоит?",
  answer:
    "Запросы оплачиваются с баланса. Подписка 999 ₽/мес включает 999 ₽ на баланс каждый месяц, а каждому новому пользователю мы дарим 200 ₽ — хватит, чтобы попробовать.",
};

export const documentsFaq: LandingFaqItem = {
  question: "Можно ли загружать документы?",
  answer:
    "Да. Прикрепите PDF, Word или таблицу — модель прочитает документ целиком, ответит на вопросы и сделает выжимку.",
};

export const sharedFaq: LandingFaqItem[] = [vpnFaq, priceFaq, documentsFaq];

export const vpnBenefit: LandingBenefit = {
  icon: "shield",
  title: "Без VPN и зарубежных карт",
  text: "Работает из России без ограничений. Оплата картами МИР, Visa, MasterCard или через СБП — в рублях.",
};

export const documentsBenefit: LandingBenefit = {
  icon: "file-text",
  title: "Понимает документы целиком",
  text: "Загрузите договор, отчёт или статью на десятки страниц — модель найдёт главное, ответит на вопросы и объяснит сложное простыми словами.",
};

export const writingBenefit: LandingBenefit = {
  icon: "pen",
  title: "Пишет как человек",
  text: "Посты, статьи, письма и описания товаров на живом русском языке — в нужном тоне и формате, без «нейросетевых» оборотов.",
};

export const lawyersAudience: LandingAudienceCard = {
  title: "Юристы и аналитики",
  text: "Анализ договоров, отчётов и таблиц: риски, выводы и краткое содержание — со ссылками на пункты.",
  userMessage:
    "Проверь договор аренды — какие пункты рискованные? 📄 dogovor.pdf",
  aiReply:
    "Нашёл **3 пункта**, на которые стоит обратить внимание. Самый важный — п. 4.2: арендодатель может…",
};

export const studentsAudience: LandingAudienceCard = {
  title: "Студенты и исследователи",
  text: "Конспекты, разбор сложных тем и работа с источниками — объяснения на вашем уровне.",
  userMessage: "Объясни трансформеры так, будто мне 15 лет",
  aiReply:
    "Представь очень внимательного читателя: он смотрит на **все слова сразу** и решает, какие важнее…",
};

export const supportAudience: LandingAudienceCard = {
  title: "Поддержка и продажи",
  text: "Быстрые ответы клиентам в нужном тоне — вежливо, по делу и без шаблонности.",
  userMessage:
    "Ответь клиенту вежливо, но твёрдо: возврат по этому заказу невозможен",
  aiReply:
    "Здравствуйте! Спасибо, что написали. К сожалению, **по условиям заказа** возврат оформить нельзя, но мы можем предложить…",
};

/** Chips shared by the GPT-5.6 landings — only models with a live landing. */
export const crossLandingChips: LandingModelChip[] = [
  { name: "Claude Opus 4.8", tag: "Текст", href: `/models/${OPUS_SLUG}` },
  { name: "Gemini 3.1 Pro", tag: "Текст", href: `/models/${GEMINI_PRO_SLUG}` },
  { name: "Grok 4.5", tag: "Текст", href: `/models/${GROK_SLUG}` },
];
