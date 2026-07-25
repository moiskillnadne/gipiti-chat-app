/** Landings for the Google Gemini text models: 3.1 Pro and 3.5 Flash. */

import {
  buildSteps,
  GEMINI_FLASH_SLUG,
  GEMINI_PRO_SLUG,
  GROK_SLUG,
  LUNA_SLUG,
  lawyersAudience,
  OPUS_SLUG,
  SOL_SLUG,
  SONAR_SLUG,
  SONNET_SLUG,
  sharedFaq,
  studentsAudience,
  supportAudience,
  vpnBenefit,
} from "./shared";
import type { ModelLanding } from "./types";

export const googleLandings: ModelLanding[] = [
  {
    slug: GEMINI_PRO_SLUG,
    modelId: "gemini-3.1-pro",
    name: "Gemini 3.1 Pro",
    vendor: "Google",
    accent: "indigo",
    badge: "Google · Флагман Gemini · Текст",
    h1Top: "Gemini 3.1 Pro —",
    h1Gradient: "нейросеть Google на русском",
    sub: "Флагманская модель Google уже в GIPITI — текст, изображения и документы в одном чате. Без VPN, на русском, с оплатой российскими картами. Дарим 200 ₽ каждому новому пользователю.",
    ctaMain: "Попробовать Gemini 3.1 Pro",
    metaTitle: "Gemini 3.1 Pro — нейросеть Google на русском без VPN | GIPITI",
    metaDescription:
      "Gemini 3.1 Pro — флагманская модель Google в GIPITI: текст, изображения и документы в одном чате. Без VPN, на русском, оплата российскими картами. Дарим 200 ₽ каждому новому пользователю.",
    heroChat: {
      userMessage:
        "Вот фото полки в магазине — как выложен наш товар и что улучшить? 📷 polka.jpg",
      aiIntro: "Разобрал снимок. Вижу **3 проблемы** выкладки:",
      aiBullets: [
        "**Уровень глаз** занят конкурентом — ваш товар на нижней полке",
        "**Ценник** перекрывает упаковку и название",
        "**Фейсинг** — всего 2 позиции против 6 у конкурента",
      ],
    },
    benefits: [
      {
        icon: "sparkles",
        title: "Флагманский интеллект Google",
        text: "Gemini 3.1 Pro уверенно ведёт сложные многошаговые задачи: глубокие рассуждения, планирование и анализ данных.",
      },
      {
        icon: "file-text",
        title: "Текст, фото и документы",
        text: "Мультимодальность в одном чате: загрузите фотографию, скриншот или PDF — модель разберёт содержимое и ответит по существу.",
      },
      {
        icon: "code",
        title: "Код и математика",
        text: "Сильные результаты в программировании и точных науках — от школьной задачи до рабочих вычислений и отладки.",
      },
      vpnBenefit,
    ],
    steps: buildSteps("Gemini 3.1 Pro"),
    audience: [
      {
        title: "Маркетологи и дизайнеры",
        text: "Анализ креативов, фото и макетов — что работает, что мешает и как улучшить.",
        userMessage: "Вот 3 варианта баннера — какой кликабельнее и почему? 📷",
        aiReply:
          "**Вариант 2**: контраст выше, одна мысль, читаемый CTA. В варианте 1 текст сливается с фоном…",
      },
      lawyersAudience,
      studentsAudience,
    ],
    faq: [
      {
        question: "Что такое Gemini 3.1 Pro?",
        answer:
          "Gemini 3.1 Pro — флагманская модель Google для сложных задач: рассуждения, код, математика и мультимодальный анализ. В GIPITI она доступна без VPN, с интерфейсом на русском языке и оплатой российскими картами.",
      },
      {
        question: "Чем Gemini отличается от ChatGPT?",
        answer:
          "Gemini — модель Google, особенно сильная в мультимодальных задачах: фотографии, скриншоты и документы она разбирает в одном чате с текстом. В GIPITI доступны и Gemini, и GPT-5.6 — сравните их на своей задаче.",
      },
      {
        question: "Чем Gemini 3.1 Pro отличается от Gemini 3.5 Flash?",
        answer:
          "Pro — глубина: сложные рассуждения, большие документы и точный анализ. Flash — скорость и низкая цена для повседневных задач. Обе модели доступны в GIPITI — переключайтесь в один клик.",
      },
      ...sharedFaq,
    ],
    otherModels: [
      {
        name: "Gemini 3.5 Flash",
        tag: "Текст",
        href: `/models/${GEMINI_FLASH_SLUG}`,
      },
      { name: "GPT-5.6 Sol", tag: "Текст", href: `/models/${SOL_SLUG}` },
      { name: "Claude Opus 4.8", tag: "Текст", href: `/models/${OPUS_SLUG}` },
      { name: "Grok 4.5", tag: "Текст", href: `/models/${GROK_SLUG}` },
    ],
  },
  {
    slug: GEMINI_FLASH_SLUG,
    modelId: "gemini-3.5-flash",
    name: "Gemini 3.5 Flash",
    vendor: "Google",
    accent: "sky",
    badge: "Google · Быстрая и доступная · Текст",
    h1Top: "Gemini 3.5 Flash —",
    h1Gradient: "быстрая нейросеть Google",
    sub: "Быстрая модель Google уже в GIPITI — мгновенные ответы с рассуждениями по минимальной цене. Без VPN, на русском, с оплатой российскими картами. Дарим 200 ₽ каждому новому пользователю.",
    ctaMain: "Попробовать Gemini 3.5 Flash",
    metaTitle:
      "Gemini 3.5 Flash — быстрая нейросеть Google на русском | GIPITI",
    metaDescription:
      "Gemini 3.5 Flash — быстрая модель Google в GIPITI: мгновенные ответы с рассуждениями по минимальной цене. Без VPN, на русском, оплата российскими картами.",
    heroChat: {
      userMessage: "Собери 5 идей для рубрики «до/после» — нужно через минуту",
      aiIntro: "Готово! Вот **5 идей** для рубрики:",
      aiBullets: [
        "**Рабочее место** — хаос против системы хранения",
        "**Утро клиента** — день до и после вашего сервиса",
        "**Цифры** — скриншот метрик за месяц работы",
      ],
    },
    benefits: [
      {
        icon: "zap",
        title: "Мгновенные ответы",
        text: "Flash отвечает практически без задержки — идеальна для переписки, выжимок, правок и быстрых итераций.",
      },
      {
        icon: "wallet",
        title: "Минимальная цена запроса",
        text: "Одни из самых доступных запросов в GIPITI — стартовых 200 ₽ и ежемесячного баланса подписки хватает надолго.",
      },
      {
        icon: "sparkles",
        title: "Умеет рассуждать",
        text: "В отличие от многих быстрых моделей, Flash включает рассуждения для задач посложнее — скорость без потери качества.",
      },
      vpnBenefit,
    ],
    steps: buildSteps("Gemini 3.5 Flash"),
    audience: [
      supportAudience,
      {
        title: "SMM и контент-команды",
        text: "Идеи, посты и адаптации под площадки — быстро и в тоне бренда.",
        userMessage: "Адаптируй этот пост из Telegram под VK и добавь хэштеги",
        aiReply:
          "Готово — тон чуть мягче, добавил **3 хэштега** и вопрос для обсуждения в конце…",
      },
      studentsAudience,
    ],
    faq: [
      {
        question: "Что такое Gemini 3.5 Flash?",
        answer:
          "Gemini 3.5 Flash — быстрая модель Google для повседневных задач: мгновенные ответы, низкая цена и умение рассуждать, когда задача этого требует. В GIPITI она доступна без VPN, с интерфейсом на русском языке и оплатой российскими картами.",
      },
      {
        question: "Чем Flash отличается от Gemini 3.1 Pro?",
        answer:
          "Flash — скорость и экономия: ответы почти мгновенные, запросы дешевле. Pro — глубина для сложных рассуждений и больших документов. Обе модели доступны в GIPITI — переключайтесь в один клик.",
      },
      {
        question: "Подойдёт ли Flash для сложных задач?",
        answer:
          "Для глубокой аналитики и больших документов лучше выбрать Gemini 3.1 Pro или GPT-5.6 Sol. Flash сильна там, где важна скорость: переписка, выжимки, посты и повседневные вопросы.",
      },
      ...sharedFaq,
    ],
    otherModels: [
      {
        name: "Gemini 3.1 Pro",
        tag: "Текст",
        href: `/models/${GEMINI_PRO_SLUG}`,
      },
      { name: "GPT-5.6 Luna", tag: "Текст", href: `/models/${LUNA_SLUG}` },
      { name: "Claude Sonnet 5", tag: "Текст", href: `/models/${SONNET_SLUG}` },
      { name: "Sonar", tag: "Текст", href: `/models/${SONAR_SLUG}` },
    ],
  },
];
