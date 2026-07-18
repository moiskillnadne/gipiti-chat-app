/** Landing for Perplexity Sonar — the search-native model. */

import {
  buildSteps,
  DEEPSEEK_SLUG,
  GEMINI_PRO_SLUG,
  GROK_SLUG,
  SOL_SLUG,
  SONAR_SLUG,
  sharedFaq,
  studentsAudience,
  vpnBenefit,
} from "./shared";
import type { ModelLanding } from "./types";

export const perplexityLandings: ModelLanding[] = [
  {
    slug: SONAR_SLUG,
    modelId: "sonar",
    name: "Sonar",
    vendor: "Perplexity",
    accent: "teal",
    badge: "Perplexity · Встроенный поиск · Текст",
    h1Top: "Perplexity Sonar —",
    h1Gradient: "нейросеть с поиском в интернете",
    sub: "Нейросеть Perplexity со встроенным поиском уже в GIPITI — свежие ответы со ссылками на источники. Без VPN, на русском, с оплатой российскими картами. Дарим 100 ₽ на баланс при регистрации.",
    ctaMain: "Попробовать Sonar",
    metaTitle: "Perplexity Sonar — нейросеть с поиском в интернете | GIPITI",
    metaDescription:
      "Perplexity Sonar в GIPITI — нейросеть со встроенным поиском в интернете: свежие ответы со ссылками на источники. Без VPN, на русском, оплата российскими картами.",
    heroChat: {
      userMessage:
        "Найди свежие исследования о влиянии кофе на сон — с источниками",
      aiIntro: "Нашёл **7 публикаций** за последние два года. Главное:",
      aiBullets: [
        "**Кофеин за 6 часов до сна** сокращает сон в среднем на 41 минуту [1]",
        "**Скорость метаболизма** кофеина различается в разы — это генетика [2]",
        "**Дневной лимит** — большинство обзоров сходятся на 400 мг [3]",
      ],
    },
    benefits: [
      {
        icon: "search",
        title: "Ищет в интернете сама",
        text: "Sonar выполняет поиск в вебе в момент запроса — отвечает по свежим данным, а не по «знаниям на дату обучения».",
      },
      {
        icon: "globe",
        title: "Ссылки на источники",
        text: "Каждый ответ сопровождается ссылками на первоисточники — легко проверить любую цифру и сослаться на неё в работе.",
      },
      {
        icon: "zap",
        title: "Быстрые ответы",
        text: "Поиск и ответ занимают секунды — быстрее, чем открыть десять вкладок и прочитать их самостоятельно.",
      },
      vpnBenefit,
    ],
    steps: buildSteps("Sonar"),
    audience: [
      {
        title: "Маркетологи и исследователи",
        text: "Обзоры рынка, конкурентов и трендов — по свежим данным, а не по памяти модели.",
        userMessage:
          "Собери обзор: что пишут о рынке доставки еды в 2026 году?",
        aiReply:
          "Собрал по **12 источникам**: рынок растёт на 9% в год, главный тренд — dark kitchen…",
      },
      {
        title: "Журналисты и редакторы",
        text: "Факт-чекинг и подбор источников — каждая цифра со ссылкой.",
        userMessage:
          "Проверь: правда ли, что в России выросло число электромобилей?",
        aiReply:
          "Да — по данным **[1]** парк вырос за год. Но есть нюанс: рост идёт с низкой базы…",
      },
      studentsAudience,
    ],
    faq: [
      {
        question: "Что такое Perplexity Sonar?",
        answer:
          "Sonar — модель Perplexity со встроенным поиском в интернете: она ищет информацию в момент запроса и отвечает со ссылками на источники. В GIPITI она доступна без VPN, с интерфейсом на русском языке и оплатой российскими картами.",
      },
      {
        question: "Чем Sonar отличается от ChatGPT?",
        answer:
          "Главное отличие — встроенный поиск: Sonar отвечает по актуальным данным из веба и даёт ссылки на источники, а не полагается только на память модели. Для новостей, цен и свежих фактов это надёжнее.",
      },
      {
        question: "Есть ли более мощные версии Sonar?",
        answer:
          "Да. В GIPITI также доступны Sonar Pro — для сложных запросов с подробными ответами — и Sonar Reasoning Pro с пошаговыми рассуждениями. Переключайтесь в один клик.",
      },
      ...sharedFaq,
    ],
    otherModels: [
      { name: "GPT-5.6 Sol", tag: "Текст", href: `/models/${SOL_SLUG}` },
      {
        name: "Gemini 3.1 Pro",
        tag: "Текст",
        href: `/models/${GEMINI_PRO_SLUG}`,
      },
      {
        name: "DeepSeek V4 Pro",
        tag: "Текст",
        href: `/models/${DEEPSEEK_SLUG}`,
      },
      { name: "Grok 4.5", tag: "Текст", href: `/models/${GROK_SLUG}` },
    ],
  },
];
