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

/** A rouble amount with the non-breaking space Russian typography wants before «₽». */
const formatRub = (amountRub: number): string => `${amountRub}\u00a0₽`;

/**
 * {@link NEW_USER_BONUS_RUB} as an upper bound, «до 200 ₽», for prose that names
 * the total: registration alone credits only {@link WELCOME_GRANT_MAJOR_UNITS}.
 */
export const NEW_USER_BONUS_UP_TO_RU = `до\u00a0${formatRub(NEW_USER_BONUS_RUB)}`;

/**
 * How {@link NEW_USER_BONUS_RUB} is earned, as a Russian fragment for prose
 * that has room for the detail. Shared so the marketing pages and the
 * agent-facing surfaces quote exactly the same split — an agent relaying "you
 * get it all at signup" would be telling users something untrue.
 */
export const NEW_USER_BONUS_BREAKDOWN_RU = `${formatRub(WELCOME_GRANT_MAJOR_UNITS)} сразу после регистрации, ещё ${formatRub(EMAIL_CONFIRM_BONUS_MAJOR_UNITS)} за подтверждение email и ${formatRub(ONBOARDING_QUIZ_BONUS_MAJOR_UNITS)} за короткий опрос о ваших задачах`;

/**
 * The new-user offer in one short line, for a badge or a sentence with no room
 * for the detail. «До» keeps it true: registration alone credits only
 * {@link WELCOME_GRANT_MAJOR_UNITS}.
 */
export const NEW_USER_BONUS_SHORT_RU = `До\u00a0${formatRub(NEW_USER_BONUS_RUB)} в подарок новым пользователям`;

/**
 * {@link NEW_USER_BONUS_SHORT_RU} cut to fit the hero badge on one line at a
 * 320px viewport.
 */
export const NEW_USER_BONUS_BADGE_RU = `До\u00a0${formatRub(NEW_USER_BONUS_RUB)} новым пользователям`;

/**
 * The new-user offer as terms: what arrives at registration and what the rest is
 * for. Shorter than {@link NEW_USER_BONUS_BREAKDOWN_RU}, for calls to action.
 * Starts with the amount, so a standalone sentence leads with a verb: «Дарим …».
 */
export const NEW_USER_BONUS_TERMS_RU = `${formatRub(WELCOME_GRANT_MAJOR_UNITS)} сразу после регистрации и ещё ${formatRub(EMAIL_CONFIRM_BONUS_MAJOR_UNITS + ONBOARDING_QUIZ_BONUS_MAJOR_UNITS)} за подтверждение email и короткий опрос`;

/**
 * What cancelling a subscription does to access and to the balance, for every
 * surface that answers it (the home FAQ, the agent skill). Matches the cancel
 * dialog (`auth.subscription.manage.cancel.*`) and the manage-subscription FAQ
 * (`auth.subscription.faq.items.q4`): access lasts to the end of the paid
 * period, then the cleanup cron zeroes the subscription pool; the top-up pool,
 * which also holds the new-user bonuses, stays and the balance gate spends it
 * with or without a subscription.
 */
export const SUBSCRIPTION_CANCELLATION_RU =
  "Подписка действует до конца оплаченного периода, списаний с карты больше не будет. Отмена не возвращает деньги за уже оплаченный период. Когда период закончится, остаток подписки на балансе сгорит. Пополнения и бонусы останутся на балансе — их можно тратить и без подписки.";

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
    title: "Без VPN и блокировок",
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
    answer: `Нет. Новым пользователям мы дарим ${NEW_USER_BONUS_UP_TO_RU} на баланс: ${NEW_USER_BONUS_BREAKDOWN_RU}. Этого достаточно, чтобы попробовать все функции платформы. Когда подаренный баланс закончится, оформите подписку: она зачисляет ${SUBSCRIPTION_PRICE_RUB} ₽ на баланс каждый месяц.`,
  },
  {
    question: "Какие платежные средства вы принимаете?",
    answer:
      "Мы принимаем оплату банковскими картами Visa, MasterCard и МИР. Все платежи обрабатываются через безопасный шлюз.",
  },
  {
    question: "Могу ли я отменить подписку?",
    answer:
      "Да, вы можете отменить подписку в любой момент в личном кабинете. Отмена вступает в силу по окончании текущего оплаченного периода.",
  },
  {
    question: "Что будет если я отменю подписку?",
    answer: SUBSCRIPTION_CANCELLATION_RU,
  },
  {
    question: "Что входит в подписку?",
    answer: `Подписка включает доступ ко всем 70+ AI-моделям от 18 провайдеров (OpenAI, Google, Anthropic, xAI, Meta, DeepSeek, Alibaba, Moonshot AI, Mistral AI, Z.ai, MiniMax, Xiaomi, Perplexity, Microsoft, Kling AI, ByteDance, BFL, Recraft), генерацию изображений и видео, генерацию кода, анализ документов, поиск в интернете и режим рассуждений. Каждый месяц на ваш баланс зачисляется ${SUBSCRIPTION_PRICE_RUB} ₽ для всех функций.`,
  },
  {
    question: "Как расходуется баланс?",
    answer: `Каждый запрос оплачивается с баланса по факту: цена зависит от модели и объёма запроса и ответа. Сначала тратится остаток подписки, затем пополнения и бонусы. Остаток подписки сгорает при продлении, когда на баланс зачисляются новые ${SUBSCRIPTION_PRICE_RUB} ₽, а пополнения и бонусы не сгорают. В личном кабинете видно каждое списание.`,
  },
];
