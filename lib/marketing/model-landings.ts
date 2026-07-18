/**
 * Curated marketing copy for per-model landing pages under /models/{slug}.
 *
 * Mirrors the "Model Landing - Text Model" Claude Design template: each landing
 * is keyed to a real model id from `lib/ai/models.ts` and rendered by
 * `components/models/landing/*`. Copy is hardcoded Russian, matching the rest
 * of the marketing surface (see `models-catalog.ts`).
 */

export type ModelLandingAccent = "indigo" | "emerald" | "warm";

export type LandingBenefitIcon =
  | "sparkles"
  | "file-text"
  | "code"
  | "zap"
  | "pen"
  | "scale"
  | "wallet"
  | "shield";

export type LandingBenefit = {
  icon: LandingBenefitIcon;
  title: string;
  text: string;
};

export type LandingStep = {
  title: string;
  text: string;
};

/** Chat snippets support `**bold**` emphasis, parsed by `parseEmphasis`. */
export type LandingAudienceCard = {
  title: string;
  text: string;
  userMessage: string;
  aiReply: string;
};

export type LandingFaqItem = {
  question: string;
  answer: string;
};

export type LandingModelChip = {
  name: string;
  tag: string;
  href: string;
};

export type LandingHeroChat = {
  userMessage: string;
  aiIntro: string;
  aiBullets: string[];
};

export type ModelLanding = {
  /** Path segment of the landing page: /models/{slug} */
  slug: string;
  /** Model id from `lib/ai/models.ts` */
  modelId: string;
  name: string;
  vendor: string;
  accent: ModelLandingAccent;
  badge: string;
  h1Top: string;
  h1Gradient: string;
  sub: string;
  ctaMain: string;
  metaTitle: string;
  metaDescription: string;
  heroChat: LandingHeroChat;
  benefits: LandingBenefit[];
  steps: LandingStep[];
  audience: LandingAudienceCard[];
  faq: LandingFaqItem[];
  otherModels: LandingModelChip[];
};

const SOL_SLUG = "gpt-5-6-sol";
const TERRA_SLUG = "gpt-5-6-terra";
const LUNA_SLUG = "gpt-5-6-luna";

const buildSteps = (name: string): LandingStep[] => [
  {
    title: "Зарегистрируйтесь",
    text: "Аккаунт за 30 секунд — нужен только email. Дарим 100 ₽ на баланс.",
  },
  {
    title: `Выберите ${name}`,
    text: "Переключитесь на модель в списке — в один клик, как и на любую из 30+.",
  },
  {
    title: "Задайте вопрос",
    text: "Текстом на русском — или прикрепите документ, ссылку или код.",
  },
  {
    title: "Получите ответ",
    text: "И продолжайте диалог в том же чате — модель помнит контекст разговора.",
  },
];

const sharedFaq: LandingFaqItem[] = [
  {
    question: "Нужен ли VPN или зарубежная карта?",
    answer:
      "Нет. GIPITI работает из России без ограничений, оплата — картами МИР, Visa, MasterCard или через СБП.",
  },
  {
    question: "Сколько это стоит?",
    answer:
      "Запросы оплачиваются с баланса. Подписка 999 ₽/мес включает 999 ₽ на баланс каждый месяц, а при регистрации мы дарим 100 ₽ — хватит, чтобы попробовать.",
  },
  {
    question: "Можно ли загружать документы?",
    answer:
      "Да. Прикрепите PDF, Word или таблицу — модель прочитает документ целиком, ответит на вопросы и сделает выжимку.",
  },
];

const vpnBenefit: LandingBenefit = {
  icon: "shield",
  title: "Без VPN и зарубежных карт",
  text: "Работает из России без ограничений. Оплата картами МИР, Visa, MasterCard или через СБП — в рублях.",
};

const documentsBenefit: LandingBenefit = {
  icon: "file-text",
  title: "Понимает документы целиком",
  text: "Загрузите договор, отчёт или статью на десятки страниц — модель найдёт главное, ответит на вопросы и объяснит сложное простыми словами.",
};

const writingBenefit: LandingBenefit = {
  icon: "pen",
  title: "Пишет как человек",
  text: "Посты, статьи, письма и описания товаров на живом русском языке — в нужном тоне и формате, без «нейросетевых» оборотов.",
};

const lawyersAudience: LandingAudienceCard = {
  title: "Юристы и аналитики",
  text: "Анализ договоров, отчётов и таблиц: риски, выводы и краткое содержание — со ссылками на пункты.",
  userMessage:
    "Проверь договор аренды — какие пункты рискованные? 📄 dogovor.pdf",
  aiReply:
    "Нашёл **3 пункта**, на которые стоит обратить внимание. Самый важный — п. 4.2: арендодатель может…",
};

const studentsAudience: LandingAudienceCard = {
  title: "Студенты и исследователи",
  text: "Конспекты, разбор сложных тем и работа с источниками — объяснения на вашем уровне.",
  userMessage: "Объясни трансформеры так, будто мне 15 лет",
  aiReply:
    "Представь очень внимательного читателя: он смотрит на **все слова сразу** и решает, какие важнее…",
};

const crossCatalogChips: LandingModelChip[] = [
  { name: "Claude Opus 4.8", tag: "Текст", href: "/models/text" },
  { name: "Gemini 3.1 Pro", tag: "Текст", href: "/models/text" },
  { name: "Grok 4.5", tag: "Текст", href: "/models/text" },
  { name: "GPT-Codex 5.3", tag: "Код", href: "/models/code" },
  { name: "Nano Banana", tag: "Изображения", href: "/models/image-generation" },
  { name: "Veo 3.1", tag: "Видео", href: "/models/video-generation" },
];

export const modelLandings: ModelLanding[] = [
  {
    slug: SOL_SLUG,
    modelId: "gpt-5.6-sol",
    name: "GPT-5.6 Sol",
    vendor: "OpenAI",
    accent: "warm",
    badge: "OpenAI · Флагман серии GPT-5.6 · Текст",
    h1Top: "GPT-5.6 Sol —",
    h1Gradient: "умный чат на русском",
    sub: "Самая мощная модель серии GPT-5.6 уже в GIPITI — глубокие рассуждения, программирование и работа с большими документами. Без VPN, на русском, с оплатой российскими картами. Дарим 100 ₽ на баланс при регистрации.",
    ctaMain: "Попробовать GPT-5.6 Sol",
    metaTitle: "GPT-5.6 Sol — умный чат на русском без VPN | GIPITI",
    metaDescription:
      "GPT-5.6 Sol — флагманская модель OpenAI в GIPITI: глубокие рассуждения, программирование и анализ документов. Без VPN, на русском, оплата российскими картами. Дарим 100 ₽ при регистрации.",
    heroChat: {
      userMessage:
        "Вот договор аренды на 40 страниц — найди рискованные пункты и объясни простыми словами 📄",
      aiIntro:
        "Прочитал договор. Нашёл **3 пункта**, на которые стоит обратить внимание:",
      aiBullets: [
        "**П. 4.2** — арендодатель может поднять плату раз в квартал, а не раз в год",
        "**П. 7.1** — штраф за расторжение равен 3 месяцам аренды",
        "**П. 9.4** — ремонт «по износу» оплачивает арендатор",
      ],
    },
    benefits: [
      {
        icon: "sparkles",
        title: "Флагманский интеллект",
        text: "Sol — самая мощная модель серии GPT-5.6: глубокие рассуждения, многошаговые задачи и агентные сценарии, где важна точность каждого шага.",
      },
      documentsBenefit,
      {
        icon: "code",
        title: "Сильна в программировании",
        text: "Пишет, отлаживает и рефакторит код на уровне лучших моделей OpenAI — от быстрого скрипта до архитектуры целого проекта.",
      },
      vpnBenefit,
    ],
    steps: buildSteps("GPT-5.6 Sol"),
    audience: [
      {
        title: "Разработчики",
        text: "Код, отладка и архитектура: от быстрого фикса до разбора целого репозитория.",
        userMessage:
          "Найди причину бага в этом файле и предложи исправление 📄 payment-service.ts",
        aiReply:
          "Причина — **гонка состояний** при повторном вызове вебхука. Вот исправление с идемпотентным ключом…",
      },
      lawyersAudience,
      {
        title: "Предприниматели и менеджеры",
        text: "Стратегии, планы и решения на данных — модель продумывает детали, как консультант.",
        userMessage:
          "Составь план выхода на рынок для сервиса доставки за 3 месяца",
        aiReply:
          "Разбил план на **4 этапа**: анализ конкурентов, пилот в одном районе, метрики юнит-экономики…",
      },
    ],
    faq: [
      {
        question: "Что такое GPT-5.6 Sol?",
        answer:
          "GPT-5.6 Sol — флагманская модель серии GPT-5.6 от OpenAI, самая мощная в линейке. В GIPITI она доступна без VPN, с интерфейсом на русском языке и оплатой российскими картами.",
      },
      {
        question: "Чем Sol отличается от Terra и Luna?",
        answer:
          "Sol — флагман серии: максимум качества в рассуждениях, коде и работе с документами. Terra — баланс цены и качества для повседневных задач, Luna — самая быстрая и доступная. Все три доступны в GIPITI — переключайтесь в один клик.",
      },
      {
        question: "Чем GPT-5.6 отличается от GPT-5.5?",
        answer:
          "Серия GPT-5.6 точнее рассуждает, лучше держит длинный контекст и пишет более естественные тексты. В GIPITI обновление включено в подписку — просто выберите модель в списке.",
      },
      ...sharedFaq,
    ],
    otherModels: [
      { name: "GPT-5.6 Terra", tag: "Текст", href: `/models/${TERRA_SLUG}` },
      { name: "GPT-5.6 Luna", tag: "Текст", href: `/models/${LUNA_SLUG}` },
      ...crossCatalogChips,
    ],
  },
  {
    slug: TERRA_SLUG,
    modelId: "gpt-5.6-terra",
    name: "GPT-5.6 Terra",
    vendor: "OpenAI",
    accent: "emerald",
    badge: "OpenAI · Оптимальный выбор · Текст",
    h1Top: "GPT-5.6 Terra —",
    h1Gradient: "нейросеть для текста без VPN",
    sub: "Сбалансированная модель серии GPT-5.6 уже в GIPITI — уровень прошлого флагмана вдвое дешевле. Пишите тексты, анализируйте документы и решайте рабочие задачи. Без VPN, на русском, с оплатой российскими картами. Дарим 100 ₽ на баланс при регистрации.",
    ctaMain: "Попробовать GPT-5.6 Terra",
    metaTitle: "GPT-5.6 Terra — нейросеть OpenAI для работы без VPN | GIPITI",
    metaDescription:
      "GPT-5.6 Terra — сбалансированная модель OpenAI в GIPITI: уровень прошлого флагмана вдвое дешевле. Тексты, документы и рабочие задачи. Без VPN, на русском, оплата российскими картами.",
    heroChat: {
      userMessage:
        "Вот отчёт о продажах за квартал — что изменилось и что делать дальше? 📄 report.xlsx",
      aiIntro: "Изучил отчёт. Главное — **3 вывода**:",
      aiBullets: [
        "**Выручка +18%** — рост за счёт повторных покупок",
        "**Отток вырос** в сегменте новых клиентов до 9%",
        "**Рекомендация** — усилить онбординг в первую неделю",
      ],
    },
    benefits: [
      {
        icon: "scale",
        title: "Уровень флагмана вдвое дешевле",
        text: "Terra отвечает на уровне прошлого флагмана GPT-5.5, а запросы стоят заметно меньше — оптимальный выбор для ежедневной работы.",
      },
      documentsBenefit,
      writingBenefit,
      vpnBenefit,
    ],
    steps: buildSteps("GPT-5.6 Terra"),
    audience: [
      {
        title: "Копирайтеры и маркетологи",
        text: "Тексты для соцсетей, рассылок и лендингов в тоне бренда — черновик за минуту вместо часа.",
        userMessage:
          "Напиши 3 варианта поста для Telegram о запуске новой коллекции",
        aiReply:
          "**Вариант 1 · интрига:** «Мы 8 месяцев молчали. Теперь можно показать…» Продолжить в этом тоне?",
      },
      lawyersAudience,
      studentsAudience,
    ],
    faq: [
      {
        question: "Что такое GPT-5.6 Terra?",
        answer:
          "GPT-5.6 Terra — сбалансированная модель серии GPT-5.6 от OpenAI: качество на уровне прошлого флагмана при заметно меньшей цене. В GIPITI она доступна без VPN, с интерфейсом на русском языке и оплатой российскими картами.",
      },
      {
        question: "Чем Terra отличается от Sol и Luna?",
        answer:
          "Terra — золотая середина серии: почти флагманское качество по умеренной цене. Sol — максимум мощности для сложных задач, Luna — самая быстрая и дешёвая. Все три доступны в GIPITI — переключайтесь в один клик.",
      },
      {
        question: "Чем GPT-5.6 Terra отличается от GPT-5.5?",
        answer:
          "Terra отвечает на уровне GPT-5.5 — прошлого флагмана OpenAI, — но её запросы стоят примерно вдвое меньше. При этом она точнее следует инструкциям и лучше держит длинный контекст.",
      },
      ...sharedFaq,
    ],
    otherModels: [
      { name: "GPT-5.6 Sol", tag: "Текст", href: `/models/${SOL_SLUG}` },
      { name: "GPT-5.6 Luna", tag: "Текст", href: `/models/${LUNA_SLUG}` },
      ...crossCatalogChips,
    ],
  },
  {
    slug: LUNA_SLUG,
    modelId: "gpt-5.6-luna",
    name: "GPT-5.6 Luna",
    vendor: "OpenAI",
    accent: "indigo",
    badge: "OpenAI · Быстрая и доступная · Текст",
    h1Top: "GPT-5.6 Luna —",
    h1Gradient: "быстрая нейросеть на русском",
    sub: "Самая быстрая модель серии GPT-5.6 уже в GIPITI — мгновенные ответы по минимальной цене. Переписка, тексты и быстрые задачи. Без VPN, на русском, с оплатой российскими картами. Дарим 100 ₽ на баланс при регистрации.",
    ctaMain: "Попробовать GPT-5.6 Luna",
    metaTitle: "GPT-5.6 Luna — быстрая нейросеть OpenAI на русском | GIPITI",
    metaDescription:
      "GPT-5.6 Luna — самая быстрая и доступная модель серии GPT-5.6 в GIPITI: мгновенные ответы по минимальной цене. Без VPN, на русском, оплата российскими картами.",
    heroChat: {
      userMessage:
        "Сделай выжимку этой статьи в 5 пунктов — она нужна мне через минуту 🔗",
      aiIntro: "Готово — **главные мысли** статьи:",
      aiBullets: [
        "**Проблема** — команды тонут в рутинных задачах",
        "**Решение** — автоматизация с помощью AI-ассистентов",
        "**Результат** — до 40% сэкономленного времени в неделю",
      ],
    },
    benefits: [
      {
        icon: "zap",
        title: "Мгновенные ответы",
        text: "Luna — самая быстрая модель серии GPT-5.6: ответ начинается почти мгновенно. Идеальна для переписки, выжимок и быстрых правок.",
      },
      {
        icon: "wallet",
        title: "Минимальная цена запроса",
        text: "Самые доступные запросы в серии — стартовых 100 ₽ и ежемесячного баланса подписки хватает надолго.",
      },
      writingBenefit,
      vpnBenefit,
    ],
    steps: buildSteps("GPT-5.6 Luna"),
    audience: [
      {
        title: "Поддержка и продажи",
        text: "Быстрые ответы клиентам в нужном тоне — вежливо, по делу и без шаблонности.",
        userMessage:
          "Ответь клиенту вежливо, но твёрдо: возврат по этому заказу невозможен",
        aiReply:
          "Здравствуйте! Спасибо, что написали. К сожалению, **по условиям заказа** возврат оформить нельзя, но мы можем предложить…",
      },
      studentsAudience,
      {
        title: "Все, кто пишет каждый день",
        text: "Письма, заметки и правки текста — быстрые итерации без ожидания.",
        userMessage: "Перепиши это письмо короче и дружелюбнее",
        aiReply:
          "Вот вариант **в 2 раза короче** — суть та же, тон легче: «Привет! Спасибо за макеты…»",
      },
    ],
    faq: [
      {
        question: "Что такое GPT-5.6 Luna?",
        answer:
          "GPT-5.6 Luna — самая быстрая и доступная модель серии GPT-5.6 от OpenAI. В GIPITI она доступна без VPN, с интерфейсом на русском языке и оплатой российскими картами.",
      },
      {
        question: "Чем Luna отличается от Sol и Terra?",
        answer:
          "Luna — выбор для скорости и экономии: мгновенные ответы по минимальной цене. Sol — флагман для сложных задач, Terra — баланс цены и качества. Все три доступны в GIPITI — переключайтесь в один клик.",
      },
      {
        question: "Подойдёт ли Luna для сложных задач?",
        answer:
          "Для глубоких рассуждений, сложного кода и больших документов лучше выбрать Sol или Terra. Luna сильна там, где важна скорость: переписка, выжимки, правки и повседневные вопросы.",
      },
      ...sharedFaq,
    ],
    otherModels: [
      { name: "GPT-5.6 Sol", tag: "Текст", href: `/models/${SOL_SLUG}` },
      { name: "GPT-5.6 Terra", tag: "Текст", href: `/models/${TERRA_SLUG}` },
      ...crossCatalogChips,
    ],
  },
];

export const getModelLandingBySlug = (slug: string): ModelLanding | undefined =>
  modelLandings.find((landing) => landing.slug === slug);

export const getModelLandingByModelId = (
  modelId: string
): ModelLanding | undefined =>
  modelLandings.find((landing) => landing.modelId === modelId);

export type EmphasisSegment = {
  id: string;
  text: string;
  isBold: boolean;
};

/**
 * Splits `**bold**` markers in landing copy into typed segments so components
 * can render emphasis without dangerouslySetInnerHTML. Odd split positions are
 * the bold runs; ids are stable per source string.
 */
export const parseEmphasis = (text: string): EmphasisSegment[] => {
  const segments: EmphasisSegment[] = [];
  let offset = 0;

  for (const [position, part] of text.split("**").entries()) {
    if (part.length > 0) {
      segments.push({
        id: `${offset}-${part.slice(0, 12)}`,
        text: part,
        isBold: position % 2 === 1,
      });
    }
    offset += part.length + 2;
  }

  return segments;
};
