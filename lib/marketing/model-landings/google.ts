/**
 * Landings for the Google Gemini text models: 3.1 Pro, 3.6 Flash, 3.5 Flash
 * and 3.5 Flash Lite.
 */

import {
  buildSteps,
  GEMINI_35_FLASH_LITE_SLUG,
  GEMINI_35_FLASH_SLUG,
  GEMINI_36_FLASH_SLUG,
  GEMINI_PRO_SLUG,
  GROK_SLUG,
  LUNA_SLUG,
  lawyersAudience,
  OPUS_5_SLUG,
  SOL_SLUG,
  SONAR_SLUG,
  SONNET_SLUG,
  sharedFaq,
  studentsAudience,
  supportAudience,
  TERRA_SLUG,
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
        question: "Чем Gemini 3.1 Pro отличается от Gemini 3.6 Flash?",
        answer:
          "Pro — глубина: сложные рассуждения, большие документы и точный анализ. Flash — скорость и низкая цена для повседневных задач. Обе модели доступны в GIPITI — переключайтесь в один клик.",
      },
      ...sharedFaq,
    ],
    otherModels: [
      {
        name: "Gemini 3.6 Flash",
        tag: "Текст",
        href: `/models/${GEMINI_36_FLASH_SLUG}`,
      },
      { name: "GPT-5.6 Sol", tag: "Текст", href: `/models/${SOL_SLUG}` },
      { name: "Claude Opus 5", tag: "Текст", href: `/models/${OPUS_5_SLUG}` },
      { name: "Grok 4.5", tag: "Текст", href: `/models/${GROK_SLUG}` },
    ],
  },
  {
    slug: GEMINI_36_FLASH_SLUG,
    modelId: "gemini-3.6-flash",
    name: "Gemini 3.6 Flash",
    vendor: "Google",
    accent: "sky",
    badge: "Google · Новейшая быстрая модель · Текст",
    h1Top: "Gemini 3.6 Flash —",
    h1Gradient: "новая быстрая нейросеть Google",
    sub: "Новейшая быстрая модель Google уже в GIPITI — качество старших моделей на скорости Flash: код, рабочие задачи и мультимодальность. Без VPN, на русском, с оплатой российскими картами. Дарим 200 ₽ каждому новому пользователю.",
    ctaMain: "Попробовать Gemini 3.6 Flash",
    metaTitle:
      "Gemini 3.6 Flash — новая нейросеть Google на русском без VPN | GIPITI",
    metaDescription:
      "Gemini 3.6 Flash — новейшая быстрая модель Google в GIPITI: код, рабочие задачи, фото и документы в одном чате. Без VPN, на русском, оплата российскими картами. Дарим 200 ₽ каждому новому пользователю.",
    heroChat: {
      userMessage:
        "Собери из этой таблицы отчёт для руководителя: главное, тренды и что делать 📄 sales.xlsx",
      aiIntro: "Готово. Вот **выжимка** по вашим данным:",
      aiBullets: [
        "**Выручка** выросла на 14% к прошлому кварталу — тянет один канал",
        "**Провал** в регионе Юг: −22%, причина в двух крупных отказах",
        "**Что делать** — перераспределить бюджет в канал, который окупается",
      ],
    },
    benefits: [
      {
        icon: "zap",
        title: "Быстро и без потери качества",
        text: "Новое поколение Flash отвечает почти мгновенно, но заметно точнее предыдущего: меньше уточняющих итераций, меньше правок за вами.",
      },
      {
        icon: "code",
        title: "Сильнее в коде и рабочих задачах",
        text: "Заметный шаг вперёд в программировании и многошаговых задачах — на уровне, который раньше требовал более дорогих моделей.",
      },
      {
        icon: "file-text",
        title: "Текст, фото и документы",
        text: "Мультимодальность в одном чате: загрузите фотографию, скриншот, PDF или таблицу — модель разберёт содержимое и ответит по существу.",
      },
      vpnBenefit,
    ],
    steps: buildSteps("Gemini 3.6 Flash"),
    audience: [
      {
        title: "Разработчики",
        text: "Ежедневный код: фиксы, ревью и объяснение чужих проектов — без ожидания.",
        userMessage: "Почему этот useEffect зацикливается? Вот компонент",
        aiReply:
          "Причина в **зависимости-объекте**: он создаётся заново на каждый рендер, поэтому эффект срабатывает бесконечно…",
      },
      lawyersAudience,
      supportAudience,
    ],
    faq: [
      {
        question: "Что такое Gemini 3.6 Flash?",
        answer:
          "Gemini 3.6 Flash — новейшая быстрая модель Google: выше качество в коде, рабочих и агентных задачах при меньшем расходе токенов, чем у предыдущих версий. В GIPITI она доступна без VPN, с интерфейсом на русском языке и оплатой российскими картами.",
      },
      {
        question: "Чем Gemini 3.6 Flash отличается от Gemini 3.5 Flash?",
        answer:
          "3.6 Flash — следующее поколение: точнее в программировании и многошаговых задачах, при этом расходует меньше токенов на ответ. Gemini 3.5 Flash остаётся доступна в GIPITI — можно сравнить обе модели на своей задаче.",
      },
      {
        question: "Чем Gemini отличается от ChatGPT?",
        answer:
          "Gemini — модель Google, особенно сильная в мультимодальных задачах: фотографии, скриншоты и документы она разбирает в одном чате с текстом. В GIPITI доступны и Gemini, и GPT-5.6 — сравните их на своей задаче.",
      },
      ...sharedFaq,
    ],
    otherModels: [
      {
        name: "Gemini 3.1 Pro",
        tag: "Текст",
        href: `/models/${GEMINI_PRO_SLUG}`,
      },
      {
        name: "Gemini 3.5 Flash Lite",
        tag: "Текст",
        href: `/models/${GEMINI_35_FLASH_LITE_SLUG}`,
      },
      { name: "GPT-5.6 Terra", tag: "Текст", href: `/models/${TERRA_SLUG}` },
      { name: "Claude Sonnet 5", tag: "Текст", href: `/models/${SONNET_SLUG}` },
    ],
  },
  {
    slug: GEMINI_35_FLASH_SLUG,
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
        name: "Gemini 3.6 Flash",
        tag: "Текст",
        href: `/models/${GEMINI_36_FLASH_SLUG}`,
      },
      {
        name: "Gemini 3.1 Pro",
        tag: "Текст",
        href: `/models/${GEMINI_PRO_SLUG}`,
      },
      { name: "GPT-5.6 Luna", tag: "Текст", href: `/models/${LUNA_SLUG}` },
      { name: "Sonar", tag: "Текст", href: `/models/${SONAR_SLUG}` },
    ],
  },
  {
    slug: GEMINI_35_FLASH_LITE_SLUG,
    modelId: "gemini-3.5-flash-lite",
    name: "Gemini 3.5 Flash Lite",
    vendor: "Google",
    accent: "emerald",
    badge: "Google · Самая экономичная · Текст",
    // NBSP keeps the em-dash attached to "Lite": the name is long enough that a
    // plain space leaves the dash orphaned on its own line in the hero H1.
    h1Top: "Gemini 3.5 Flash Lite\u00A0—",
    h1Gradient: "самая экономичная нейросеть Google",
    sub: "Самая доступная модель Google уже в GIPITI — мгновенные ответы для простых и объёмных задач за копейки. Без VPN, на русском, с оплатой российскими картами. Дарим 200 ₽ каждому новому пользователю.",
    // Short label on purpose: the full name wraps the hero CTA onto two lines.
    ctaMain: "Попробовать Flash Lite",
    metaTitle:
      "Gemini 3.5 Flash Lite — дешёвая нейросеть Google на русском | GIPITI",
    metaDescription:
      "Gemini 3.5 Flash Lite — самая экономичная модель Google в GIPITI: мгновенные ответы для простых и объёмных задач. Без VPN, на русском, оплата российскими картами.",
    heroChat: {
      userMessage:
        "Разбери эти 40 отзывов на плюсы и минусы и посчитай, что повторяется чаще",
      aiIntro: "Разобрал все отзывы. **Коротко** по итогам:",
      aiBullets: [
        "**Плюсы** — быстрая доставка (18 упоминаний), удобный сайт (11)",
        "**Минусы** — упаковка (9), долгий ответ поддержки (7)",
        "**Вывод** — доставка вас хвалит, поддержка тянет оценку вниз",
      ],
    },
    benefits: [
      {
        icon: "wallet",
        title: "Самая низкая цена запроса",
        text: "Самые дешёвые запросы среди текстовых моделей GIPITI — стартовых 200 ₽ хватит на очень долгую работу.",
      },
      {
        icon: "zap",
        title: "Отвечает мгновенно",
        text: "Идеальна там, где важна скорость и объём: перевод, выжимки, сортировка заметок, короткие ответы и рутинные правки.",
      },
      {
        icon: "sparkles",
        title: "Рассуждает, когда нужно",
        text: "Несмотря на «лёгкость», модель умеет включать рассуждения — а значит справляется и с задачами посложнее обычной болтовни.",
      },
      vpnBenefit,
    ],
    steps: buildSteps("Gemini 3.5 Flash Lite"),
    audience: [
      supportAudience,
      {
        title: "Небольшой бизнес",
        text: "Рутина без лишних трат: описания товаров, письма, ответы на отзывы и типовые документы.",
        userMessage: "Напиши 10 коротких описаний товаров по этому списку",
        aiReply:
          "Готово — по **2 предложения** на товар, с выгодой в первом и деталями во втором…",
      },
      studentsAudience,
    ],
    faq: [
      {
        question: "Что такое Gemini 3.5 Flash Lite?",
        answer:
          "Gemini 3.5 Flash Lite — самая лёгкая и экономичная модель Google: мгновенные ответы по минимальной цене, с возможностью рассуждать над задачами посложнее. В GIPITI она доступна без VPN, с интерфейсом на русском языке и оплатой российскими картами.",
      },
      {
        question: "Чем Flash Lite отличается от Gemini 3.6 Flash?",
        answer:
          "Flash Lite — максимальная экономия для простых и объёмных задач. Gemini 3.6 Flash — заметно сильнее в коде и рабочих задачах при по-прежнему высокой скорости. Обе модели доступны в GIPITI — переключайтесь в один клик.",
      },
      {
        question: "Для каких задач лучше выбрать другую модель?",
        answer:
          "Для сложной аналитики, больших документов и ответственных текстов возьмите Gemini 3.1 Pro, GPT-5.6 Sol или Claude Opus 5. Flash Lite создана для потока простых задач, где важнее скорость и цена.",
      },
      ...sharedFaq,
    ],
    otherModels: [
      {
        name: "Gemini 3.6 Flash",
        tag: "Текст",
        href: `/models/${GEMINI_36_FLASH_SLUG}`,
      },
      {
        name: "Gemini 3.5 Flash",
        tag: "Текст",
        href: `/models/${GEMINI_35_FLASH_SLUG}`,
      },
      { name: "GPT-5.6 Luna", tag: "Текст", href: `/models/${LUNA_SLUG}` },
      { name: "Claude Opus 5", tag: "Текст", href: `/models/${OPUS_5_SLUG}` },
    ],
  },
];
