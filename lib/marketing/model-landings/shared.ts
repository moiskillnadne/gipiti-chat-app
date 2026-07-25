/**
 * Copy blocks reused across model landings: slugs for cross-linking, shared
 * FAQ items, benefits, audience cards and the cross-catalog chip list.
 */

import type {
  LandingAudienceCard,
  LandingBenefit,
  LandingFaqItem,
  LandingModelChip,
  LandingStep,
} from "./types";

export const SOL_SLUG = "gpt-5-6-sol";
export const TERRA_SLUG = "gpt-5-6-terra";
export const LUNA_SLUG = "gpt-5-6-luna";
export const OPUS_SLUG = "claude-opus-4-8";
export const SONNET_SLUG = "claude-sonnet-5";
export const GEMINI_PRO_SLUG = "gemini-3-1-pro";
export const GEMINI_FLASH_SLUG = "gemini-3-5-flash";
export const SONAR_SLUG = "perplexity-sonar";
export const GROK_SLUG = "grok-4-5";
export const DEEPSEEK_SLUG = "deepseek-v4-pro";

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
