/**
 * Landing for DeepSeek V4 Pro.
 *
 * Note: the model has no attachments capability in the registry, so the copy
 * deliberately avoids "upload a document" claims — users paste text instead.
 * The shared documents FAQ is replaced with a context-size one.
 */

import {
  buildSteps,
  DEEPSEEK_SLUG,
  GROK_SLUG,
  priceFaq,
  SONAR_SLUG,
  SONNET_SLUG,
  studentsAudience,
  TERRA_SLUG,
  vpnBenefit,
  vpnFaq,
} from "./shared";
import type { LandingFaqItem, ModelLanding } from "./types";

const contextFaq: LandingFaqItem = {
  question: "Какой размер контекста у DeepSeek V4 Pro?",
  answer:
    "До миллиона токенов — это сотни страниц текста или целая кодовая база. Вставьте материал прямо в чат — модель удержит всё и не потеряет деталей.",
};

export const deepseekLandings: ModelLanding[] = [
  {
    slug: DEEPSEEK_SLUG,
    modelId: "deepseek-v4-pro",
    name: "DeepSeek V4 Pro",
    vendor: "DeepSeek",
    accent: "blue",
    badge: "DeepSeek · Флагман линейки · Текст",
    h1Top: "DeepSeek V4 Pro —",
    h1Gradient: "рассуждающая нейросеть на русском",
    sub: "Флагман DeepSeek уже в GIPITI — глубокие рассуждения и контекст до миллиона токенов по разумной цене. Без VPN, на русском, с оплатой российскими картами. Дарим 100 ₽ на баланс при регистрации.",
    ctaMain: "Попробовать DeepSeek V4 Pro",
    metaTitle:
      "DeepSeek V4 Pro — нейросеть DeepSeek на русском без VPN | GIPITI",
    metaDescription:
      "DeepSeek V4 Pro в GIPITI — глубокие рассуждения и контекст до миллиона токенов по разумной цене. Без VPN, на русском, оплата российскими картами. Дарим 100 ₽ при регистрации.",
    heroChat: {
      userMessage:
        "Вставил модуль расчёта скидок целиком — почему итоговая цена иногда отрицательная?",
      aiIntro: "Прочитал все **4 200 строк**. Причина найдена:",
      aiBullets: [
        "**Порядок применения** — фиксированная скидка вычитается после процентной",
        "**Нет нижней границы** — итоговая сумма не ограничена нулём",
        "**Исправление** — добавьте Math.max(0, …) в финальный расчёт",
      ],
    },
    benefits: [
      {
        icon: "sparkles",
        title: "Глубокие рассуждения",
        text: "V4 Pro рассуждает пошагово от природы: сложная логика, математика и планирование — без компромиссов по качеству.",
      },
      {
        icon: "file-text",
        title: "Контекст до миллиона токенов",
        text: "Вставьте целую книгу, стенограмму или кодовую базу — модель удержит всё и не потеряет деталей в середине.",
      },
      {
        icon: "wallet",
        title: "Флагман по разумной цене",
        text: "DeepSeek традиционно даёт максимум интеллекта за минимальные деньги — запросы заметно дешевле западных флагманов.",
      },
      vpnBenefit,
    ],
    steps: buildSteps(
      "DeepSeek V4 Pro",
      "Текстом на русском — вставьте вопрос, код или большой фрагмент текста прямо в чат."
    ),
    audience: [
      {
        title: "Разработчики",
        text: "Большие кодовые базы целиком: архитектура, поиск багов и связи между модулями.",
        userMessage:
          "Вставил три модуля сервиса — найди, где теряется контекст транзакции",
        aiReply:
          "Проследил цепочку вызовов: транзакция теряется в **очереди задач** — обработчик открывает новое соединение…",
      },
      {
        title: "Исследователи и аналитики",
        text: "Длинные тексты и большие массивы данных — вставьте целиком, контекста хватит.",
        userMessage:
          "Вставил стенограмму трёх интервью — какие проблемы называют все спикеры?",
        aiReply:
          "Все три спикера сходятся в **2 болях**: ручная отчётность и потеря заявок между отделами…",
      },
      studentsAudience,
    ],
    faq: [
      {
        question: "Что такое DeepSeek V4 Pro?",
        answer:
          "DeepSeek V4 Pro — флагманская модель DeepSeek: глубокие пошаговые рассуждения и контекст до миллиона токенов. В GIPITI она доступна без VPN, с интерфейсом на русском языке и оплатой российскими картами.",
      },
      {
        question: "Чем DeepSeek отличается от ChatGPT?",
        answer:
          "DeepSeek известен флагманским качеством по заметно меньшей цене, а V4 Pro к тому же держит контекст до миллиона токенов. В GIPITI доступны и DeepSeek, и GPT-5.6 — сравните их на своей задаче.",
      },
      {
        question: "Чем V4 Pro отличается от V4 Flash?",
        answer:
          "V4 Pro — глубина: максимальные рассуждения и контекст до миллиона токенов. V4 Flash — быстрее и дешевле для повседневных задач. Обе модели доступны в GIPITI — переключайтесь в один клик.",
      },
      vpnFaq,
      priceFaq,
      contextFaq,
    ],
    otherModels: [
      { name: "GPT-5.6 Terra", tag: "Текст", href: `/models/${TERRA_SLUG}` },
      { name: "Claude Sonnet 5", tag: "Текст", href: `/models/${SONNET_SLUG}` },
      { name: "Sonar", tag: "Текст", href: `/models/${SONAR_SLUG}` },
      { name: "Grok 4.5", tag: "Текст", href: `/models/${GROK_SLUG}` },
    ],
  },
];
