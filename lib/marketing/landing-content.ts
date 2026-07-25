/**
 * Copy for the home page sections (`components/landing/*`).
 *
 * The sections used to hold this data inline, but the Markdown representation
 * of `/` served to agents (`lib/agent-discovery/markdown/home.ts`) needs the
 * same text. Keeping one copy here stops the HTML and Markdown views of the
 * home page from drifting apart.
 *
 * Icons stay as string keys — the same indirection `model-landings/types.ts`
 * uses — so this module carries no React imports and can be read from a route
 * handler.
 */

import {
  EMAIL_CONFIRM_BONUS_MAJOR_UNITS,
  ONBOARDING_QUIZ_BONUS_MAJOR_UNITS,
  WELCOME_GRANT_MAJOR_UNITS,
} from "@/lib/billing/constants";

export type HomeFeatureIcon =
  | "message-square"
  | "image"
  | "video"
  | "code"
  | "file-text"
  | "search"
  | "brain"
  | "zap";

export type HomeBenefitIcon = "globe" | "wallet" | "languages" | "piggy-bank";

export type HomeFeature = {
  icon: HomeFeatureIcon;
  title: string;
  description: string;
};

export type HomeBenefit = {
  icon: HomeBenefitIcon;
  title: string;
  description: string;
};

export type HomeFaqItem = {
  question: string;
  answer: string;
};

/** Monthly subscription price, in roubles. */
export const SUBSCRIPTION_PRICE_RUB = 999;

/**
 * Everything a new user can earn, in roubles: the signup credit, confirming
 * their email, and the onboarding quiz.
 *
 * Derived from the billing constants rather than hardcoded, so the public offer
 * cannot drift from what is actually credited. Note this is NOT the amount
 * granted at registration — most of it is earned after confirming the email,
 * which is deliberate (see WELCOME_GRANT_MAJOR_UNITS).
 */
export const NEW_USER_BONUS_RUB =
  WELCOME_GRANT_MAJOR_UNITS +
  EMAIL_CONFIRM_BONUS_MAJOR_UNITS +
  ONBOARDING_QUIZ_BONUS_MAJOR_UNITS;

/**
 * How {@link NEW_USER_BONUS_RUB} is earned, as a Russian fragment for prose
 * that has room for the detail. Shared so the marketing pages and the
 * agent-facing surfaces quote exactly the same split — an agent relaying "you
 * get it all at signup" would be telling users something untrue.
 */
export const NEW_USER_BONUS_BREAKDOWN_RU = `${WELCOME_GRANT_MAJOR_UNITS} ₽ сразу после регистрации, ещё ${EMAIL_CONFIRM_BONUS_MAJOR_UNITS} ₽ за подтверждение email и ${ONBOARDING_QUIZ_BONUS_MAJOR_UNITS} ₽ за короткий опрос о ваших задачах`;

export const homeFeatures: HomeFeature[] = [
  {
    icon: "message-square",
    title: "Умный чат",
    description: "Общайтесь с лучшими AI-моделями в одном месте",
  },
  {
    icon: "image",
    title: "Генерация изображений",
    description:
      "Создавайте изображения с GPT Image, Gemini, Flux, Recraft и Grok Imagine",
  },
  {
    icon: "video",
    title: "Генерация видео",
    description:
      "Создавайте видео с Veo 3.1 и Grok Imagine Video по текстовому описанию",
  },
  {
    icon: "code",
    title: "Генерация кода",
    description:
      "Пишите и улучшайте код с GPT-Codex и другими ведущими AI-моделями",
  },
  {
    icon: "file-text",
    title: "Анализ документов",
    description: "Загружайте PDF, изображения и текстовые файлы до 10MB",
  },
  {
    icon: "search",
    title: "Поиск в интернете",
    description: "AI получает актуальную информацию из сети",
  },
  {
    icon: "brain",
    title: "Режим рассуждений",
    description: "Расширенный анализ для сложных задач",
  },
  {
    icon: "zap",
    title: "Быстрые ответы",
    description: "Мгновенные ответы от ведущих AI-моделей",
  },
];

export const homeBenefits: HomeBenefit[] = [
  {
    icon: "globe",
    title: "Без VPN и ограничений",
    description:
      "Пользуйтесь из любой точки мира без региональных блокировок. VPN не нужен — просто откройте сайт и начните работать.",
  },
  {
    icon: "wallet",
    title: "Оплата российскими картами",
    description:
      "Платите в рублях картами Visa, MasterCard и МИР. Никаких зарубежных карт и валютных конвертаций.",
  },
  {
    icon: "languages",
    title: "Полная поддержка на русском",
    description:
      "Интерфейс, поддержка и документация полностью на русском языке.",
  },
  {
    icon: "piggy-bank",
    title: "Дешевле, чем 6 подписок",
    description:
      "Все ведущие AI-модели от 6 сервисов в одной подписке — значительно выгоднее, чем платить за каждый отдельно.",
  },
];

export const pricingFeatures: string[] = [
  "Доступ ко всем AI-моделям",
  "ChatGPT, Gemini, Claude, Grok",
  "Flux, Recraft и другие",
  "Генерация изображений и видео",
  "Генерация кода",
  "Анализ документов до 10MB",
  "Поиск в интернете",
  "Режим рассуждений",
  `${SUBSCRIPTION_PRICE_RUB} ₽ на баланс каждый месяц`,
];

export const homeFaqItems: HomeFaqItem[] = [
  {
    question: "Что такое Гипити?",
    answer:
      "Гипити (GIPITI) — это российская платформа-агрегатор нейросетей. В одном чате доступны лучшие AI-модели: ChatGPT, Gemini, Claude и Grok, а также генерация изображений, видео и кода. Доступно из России, оплата в рублях.",
  },
  {
    question: "Нужно ли платить, чтобы начать?",
    answer: `Нет. Мы дарим ${NEW_USER_BONUS_RUB} ₽ на баланс каждому новому пользователю: ${NEW_USER_BONUS_BREAKDOWN_RU}. Этого достаточно, чтобы попробовать все функции платформы. Когда баланс закончится, вы можете пополнить его или оформить подписку.`,
  },
  {
    question: "Какие платежные средства вы принимаете?",
    answer:
      "Мы принимаем оплату банковскими картами Visa, MasterCard и МИР. Все платежи обрабатываются через безопасный шлюз.",
  },
  {
    question: "Могу ли я отменить подписку?",
    answer:
      "Да, вы можете отменить подписку в любой момент в настройках аккаунта. Отмена вступает в силу по окончании текущего оплаченного периода.",
  },
  {
    question: "Что будет если я отменю подписку?",
    answer:
      "После отмены подписка продолжает действовать до конца оплаченного периода — вы пользуетесь сервисом без ограничений. Когда период закончится, аккаунт и история чатов сохранятся, но для новых запросов потребуется активная подписка.",
  },
  {
    question: "Что входит в подписку?",
    answer: `Подписка включает доступ ко всем 30+ AI-моделям от 10 провайдеров (OpenAI, Google, Anthropic, xAI, DeepSeek, Perplexity, Kling AI, ByteDance, BFL, Recraft), генерацию изображений и видео, генерацию кода, анализ документов, поиск в интернете и режим рассуждений. Каждый месяц на ваш баланс зачисляется ${SUBSCRIPTION_PRICE_RUB} ₽ для всех функций.`,
  },
  {
    question: "Как работают лимиты?",
    answer: `Подписка зачисляет ${SUBSCRIPTION_PRICE_RUB} ₽ на баланс каждый месяц. Баланс расходуется на ваши запросы и ответы AI, а при необходимости его можно пополнить в любой момент. В личном кабинете вы всегда можете отслеживать текущий расход.`,
  },
];
