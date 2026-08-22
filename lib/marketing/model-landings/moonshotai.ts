/** Landing for the Moonshot AI text model: Kimi K3 Fast. */

import {
  buildSteps,
  DEEPSEEK_SLUG,
  documentsBenefit,
  GEMINI_37_FLASH_SLUG,
  GROK_46_SLUG,
  KIMI_K3_FAST_SLUG,
  QWEN_38_MAX_SLUG,
  SOL_SLUG,
  sharedFaq,
  studentsAudience,
  vpnBenefit,
} from "./shared";
import type { ModelLanding } from "./types";

export const moonshotaiLandings: ModelLanding[] = [
  {
    kind: "text",
    slug: KIMI_K3_FAST_SLUG,
    modelId: "kimi-k3-fast",
    name: "Kimi K3 Fast",
    vendor: "Moonshot AI",
    accent: "violet",
    badge: "Moonshot AI · Новинка · Текст",
    h1Top: "Kimi K3 Fast —",
    h1Gradient: "нейросеть Moonshot AI на русском",
    sub: "Быстрая версия флагмана Moonshot AI уже в GIPITI — длинные задачи по программированию и контекст на миллион токенов. Без VPN, на русском, с оплатой российскими картами. Дарим 200 ₽ каждому новому пользователю.",
    ctaMain: "Попробовать Kimi K3 Fast",
    metaTitle:
      "Kimi K3 Fast — нейросеть Moonshot AI на русском без VPN | GIPITI",
    metaDescription:
      "Kimi K3 Fast — быстрая версия флагмана Moonshot AI в GIPITI: программирование, длинные задачи и контекст до миллиона токенов. Без VPN, на русском, оплата российскими картами.",
    heroChat: {
      userMessage:
        "Разбери этот модуль на 3000 строк и предложи, как его разделить",
      aiIntro: "Прочитал целиком. **Три естественные границы**:",
      aiBullets: [
        "**Работа с API** — 11 функций, зависят только друг от друга",
        "**Форматирование** — чистые функции без состояния, выносятся первыми",
        "**Остальное** — тонкий слой, который свяжет две части",
      ],
    },
    benefits: [
      {
        icon: "code",
        title: "Заточена под длинный код",
        text: "Kimi K3 создавалась для многошаговой работы с кодом: держит цель на десятках правок и не забывает, что уже сделала.",
      },
      {
        icon: "layers",
        title: "Миллион токенов контекста",
        text: "Загрузите большой проект или объёмный свод документов — модель будет обсуждать его целиком, а не по кускам.",
      },
      documentsBenefit,
      vpnBenefit,
    ],
    steps: buildSteps("Kimi K3 Fast"),
    audience: [
      {
        title: "Разработчики",
        text: "Долгие задачи по коду: рефакторинг, миграции и разбор незнакомого проекта.",
        userMessage:
          "Перепиши этот класс на композицию и объясни каждое изменение",
        aiReply:
          "Разбил на три зависимости. Первая — **хранилище**: раньше класс сам ходил в базу, теперь…",
      },
      {
        title: "Технические писатели",
        text: "Документация по большому проекту — с опорой на исходный код, а не на догадки.",
        userMessage: "Опиши публичное API этого пакета для README",
        aiReply:
          "Публичных точек входа **семь**. Начну с основной — `createClient(options)`…",
      },
      studentsAudience,
    ],
    faq: [
      {
        question: "Что такое Kimi K3 Fast?",
        answer:
          "Kimi K3 Fast — быстрая версия флагманской модели Moonshot AI. Она рассчитана на длинные задачи по программированию и работу с большими объёмами текста: контекст модели — до миллиона токенов. В GIPITI доступна без VPN, на русском и с оплатой российскими картами.",
      },
      {
        question: "Можно ли прикреплять файлы?",
        answer:
          "Да, изображения и файлы Word — модель прочитает их прямо в чате. Для PDF лучше выбрать Gemini, GPT-5.6 или Claude: они разбирают такие документы напрямую.",
      },
      {
        question: "Когда лучше выбрать другую модель?",
        answer:
          "Если нужен разбор PDF или максимально глубокая аналитика — возьмите Claude Opus 5 или Gemini 3.7 Flash. Kimi K3 Fast сильна там, где важны длинный код и большой контекст.",
      },
      ...sharedFaq,
    ],
    otherModels: [
      {
        name: "Qwen 3.8 Max",
        tag: "Текст",
        href: `/models/${QWEN_38_MAX_SLUG}`,
      },
      {
        name: "DeepSeek V4 Pro",
        tag: "Текст",
        href: `/models/${DEEPSEEK_SLUG}`,
      },
      { name: "GPT-5.6 Sol", tag: "Текст", href: `/models/${SOL_SLUG}` },
      { name: "Grok 4.6", tag: "Текст", href: `/models/${GROK_46_SLUG}` },
      {
        name: "Gemini 3.7 Flash",
        tag: "Текст",
        href: `/models/${GEMINI_37_FLASH_SLUG}`,
      },
    ],
  },
];
