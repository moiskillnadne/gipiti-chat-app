/** Landings for the Anthropic Claude models: Opus 4.8 and Sonnet 5. */

import {
  buildSteps,
  documentsBenefit,
  GEMINI_PRO_SLUG,
  GROK_SLUG,
  lawyersAudience,
  OPUS_SLUG,
  SOL_SLUG,
  SONNET_SLUG,
  sharedFaq,
  studentsAudience,
  TERRA_SLUG,
  vpnBenefit,
  writingBenefit,
} from "./shared";
import type { ModelLanding } from "./types";

export const anthropicLandings: ModelLanding[] = [
  {
    slug: OPUS_SLUG,
    modelId: "opus-4.8",
    name: "Claude Opus 4.8",
    vendor: "Anthropic",
    accent: "warm",
    badge: "Anthropic · Сильнейшая модель Claude · Текст",
    h1Top: "Claude Opus 4.8 —",
    h1Gradient: "сильнейшая нейросеть Anthropic",
    sub: "Сильнейшая модель Anthropic уже в GIPITI — глубокая аналитика, эталонная редактура и работа с большим контекстом. Без VPN, на русском, с оплатой российскими картами. Дарим 200 ₽ каждому новому пользователю.",
    ctaMain: "Попробовать Claude Opus 4.8",
    metaTitle: "Claude Opus 4.8 — нейросеть Claude на русском без VPN | GIPITI",
    metaDescription:
      "Claude Opus 4.8 — сильнейшая модель Anthropic в GIPITI: глубокая аналитика, редактура и большой контекст. Без VPN, на русском, оплата российскими картами. Дарим 200 ₽ каждому новому пользователю.",
    heroChat: {
      userMessage:
        "Вот старая и новая редакции контракта — что изменилось и где подвох? 📄 v1.pdf 📄 v2.pdf",
      aiIntro: "Сравнил обе версии. Изменений **11**, важных — **3**:",
      aiBullets: [
        "**П. 6.3** — срок оплаты вырос с 10 до 45 дней",
        "**П. 8.1** — добавлена односторонняя индексация цены",
        "**Приложение 2** — из спецификации исчезла гарантия",
      ],
    },
    benefits: [
      {
        icon: "sparkles",
        title: "Сильнейшая модель Anthropic",
        text: "Opus 4.8 — вершина линейки Claude: глубокий анализ, сложные рассуждения и расширенный контекст для по-настоящему больших задач.",
      },
      documentsBenefit,
      {
        icon: "pen",
        title: "Эталонная работа с текстом",
        text: "Claude славится качеством языка: аккуратная редактура, выверенная структура и стиль, который не приходится переписывать.",
      },
      vpnBenefit,
    ],
    steps: buildSteps("Claude Opus 4.8"),
    audience: [
      lawyersAudience,
      {
        title: "Редакторы и авторы",
        text: "Редактура, структура и стиль длинных текстов — от статьи до книги.",
        userMessage:
          "Отредактируй главу: убери канцелярит, но сохрани мой тон 📄 glava3.docx",
        aiReply:
          "Готово. Текст стал короче на **18%**: заменил пассивные обороты, разбил длинные абзацы…",
      },
      {
        title: "Аналитики и консультанты",
        text: "Выводы и рекомендации из отчётов, исследований и данных — как от сильного коллеги.",
        userMessage:
          "Сравни три коммерческих предложения и порекомендуй лучшее 📄",
        aiReply:
          "По совокупности критериев выигрывает **вариант Б** — на 12% дешевле при том же SLA…",
      },
    ],
    faq: [
      {
        question: "Что такое Claude Opus 4.8?",
        answer:
          "Claude Opus 4.8 — сильнейшая модель Anthropic: глубокая аналитика, работа с большим контекстом и эталонное качество текста. В GIPITI она доступна без VPN, с интерфейсом на русском языке и оплатой российскими картами.",
      },
      {
        question: "Чем Claude отличается от ChatGPT?",
        answer:
          "Claude особенно силён в аккуратной работе с текстом, редактуре и анализе длинных документов. В GIPITI доступны и Claude, и GPT-5.6 — сравните их на своей задаче в одном интерфейсе.",
      },
      {
        question: "Чем Opus 4.8 отличается от Sonnet 5?",
        answer:
          "Opus — максимум качества для сложной аналитики и больших текстов. Sonnet 5 — быстрее и дешевле для повседневной работы и кода. Обе модели доступны в GIPITI — переключайтесь в один клик.",
      },
      ...sharedFaq,
    ],
    otherModels: [
      { name: "Claude Sonnet 5", tag: "Текст", href: `/models/${SONNET_SLUG}` },
      { name: "GPT-5.6 Sol", tag: "Текст", href: `/models/${SOL_SLUG}` },
      {
        name: "Gemini 3.1 Pro",
        tag: "Текст",
        href: `/models/${GEMINI_PRO_SLUG}`,
      },
      { name: "Grok 4.5", tag: "Текст", href: `/models/${GROK_SLUG}` },
    ],
  },
  {
    slug: SONNET_SLUG,
    modelId: "sonnet-5",
    name: "Claude Sonnet 5",
    vendor: "Anthropic",
    accent: "rose",
    badge: "Anthropic · Новое поколение Sonnet · Текст",
    h1Top: "Claude Sonnet 5 —",
    h1Gradient: "нейросеть для работы и кода",
    sub: "Новое поколение сбалансированной модели Anthropic уже в GIPITI — быстрые рассуждения, сильная генерация кода и повседневные задачи. Без VPN, на русском, с оплатой российскими картами. Дарим 200 ₽ каждому новому пользователю.",
    ctaMain: "Попробовать Claude Sonnet 5",
    metaTitle: "Claude Sonnet 5 — чат с нейросетью Claude без VPN | GIPITI",
    metaDescription:
      "Claude Sonnet 5 — новое поколение модели Anthropic в GIPITI: быстрые рассуждения, сильный код и повседневные задачи. Без VPN, на русском, оплата российскими картами.",
    heroChat: {
      userMessage:
        "Посмотри pull request — есть ли проблемы, которые я не заметил? 📄 diff.patch",
      aiIntro: "Просмотрел изменения. Код хороший, но есть **2 момента**:",
      aiBullets: [
        "**Утечка подписки** — useEffect без cleanup при смене chatId",
        "**N+1 запрос** — авторы комментариев загружаются в цикле",
        "**Совет** — маппер повторяется трижды, стоит вынести в утилиту",
      ],
    },
    benefits: [
      {
        icon: "zap",
        title: "Быстрые рассуждения",
        text: "Новое поколение Sonnet думает быстро: модель рассуждает над задачей, но не заставляет ждать — баланс скорости и глубины.",
      },
      {
        icon: "code",
        title: "Сильная генерация кода",
        text: "Пишет, отлаживает и рефакторит код на уровне старших моделей — отличный выбор для ежедневной разработки.",
      },
      writingBenefit,
      vpnBenefit,
    ],
    steps: buildSteps("Claude Sonnet 5"),
    audience: [
      {
        title: "Разработчики",
        text: "Код, ревью и рефакторинг: от быстрого фикса до продуманной миграции.",
        userMessage:
          "Напиши миграцию: разделить таблицу users на профиль и настройки",
        aiReply:
          "Готово — план из **3 шагов**: новая таблица, бэкфилл батчами, переключение чтения…",
      },
      {
        title: "Копирайтеры и маркетологи",
        text: "Статьи, лендинги и рассылки — быстрый черновик и аккуратная редактура.",
        userMessage: "Сократи этот лендинг вдвое, сохранив главные выгоды",
        aiReply:
          "Сократил до **540 слов**: убрал повторы, усилил заголовки — выгоды теперь на первом экране…",
      },
      studentsAudience,
    ],
    faq: [
      {
        question: "Что такое Claude Sonnet 5?",
        answer:
          "Claude Sonnet 5 — новое поколение сбалансированной модели Anthropic: быстрые рассуждения, сильная генерация кода и уверенная работа с текстом. В GIPITI она доступна без VPN, с интерфейсом на русском языке и оплатой российскими картами.",
      },
      {
        question: "Чем Sonnet 5 отличается от Opus 4.8?",
        answer:
          "Sonnet 5 — баланс скорости, качества и цены для ежедневной работы. Opus 4.8 — максимум глубины для сложной аналитики и больших документов. Обе модели доступны в GIPITI — переключайтесь в один клик.",
      },
      {
        question: "Чем Sonnet 5 отличается от Sonnet 4.6?",
        answer:
          "Sonnet 5 — следующее поколение: точнее рассуждает, заметно лучше пишет код и стабильнее держит длинный контекст при сопоставимой цене запроса.",
      },
      ...sharedFaq,
    ],
    otherModels: [
      { name: "Claude Opus 4.8", tag: "Текст", href: `/models/${OPUS_SLUG}` },
      { name: "GPT-5.6 Terra", tag: "Текст", href: `/models/${TERRA_SLUG}` },
      {
        name: "Gemini 3.1 Pro",
        tag: "Текст",
        href: `/models/${GEMINI_PRO_SLUG}`,
      },
      { name: "Grok 4.5", tag: "Текст", href: `/models/${GROK_SLUG}` },
    ],
  },
];
