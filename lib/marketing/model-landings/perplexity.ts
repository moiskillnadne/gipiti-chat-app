/**
 * Landings for the search-native Perplexity models: Sonar, Sonar Pro and
 * Sonar Reasoning Pro.
 *
 * Note: these models have search built in and reject tool definitions, so the
 * copy never promises image generation or other in-chat tools. Sonar Reasoning
 * Pro also has no attachments capability — its copy avoids upload claims and
 * swaps the shared documents FAQ for a sources one.
 */

import {
  buildSteps,
  DEEPSEEK_SLUG,
  GEMINI_PRO_SLUG,
  GROK_SLUG,
  OPUS_5_SLUG,
  priceFaq,
  SOL_SLUG,
  SONAR_PRO_SLUG,
  SONAR_REASONING_SLUG,
  SONAR_SLUG,
  sharedFaq,
  studentsAudience,
  TERRA_SLUG,
  vpnBenefit,
  vpnFaq,
} from "./shared";
import type { LandingBenefit, LandingFaqItem, ModelLanding } from "./types";

const sourcesBenefit: LandingBenefit = {
  icon: "globe",
  title: "Ссылки на источники",
  text: "Каждый ответ сопровождается ссылками на первоисточники — легко проверить любую цифру и сослаться на неё в работе.",
};

const sourcesFaq: LandingFaqItem = {
  question: "Откуда модель берёт информацию?",
  answer:
    "Из открытых источников в интернете: она выполняет поиск в момент запроса и складывает ответ из найденных страниц, перечисляя их ссылками под ответом.",
};

export const perplexityLandings: ModelLanding[] = [
  {
    kind: "text",
    slug: SONAR_SLUG,
    modelId: "sonar",
    name: "Sonar",
    vendor: "Perplexity",
    accent: "teal",
    badge: "Perplexity · Встроенный поиск · Текст",
    h1Top: "Perplexity Sonar —",
    h1Gradient: "нейросеть с поиском в интернете",
    sub: "Нейросеть Perplexity со встроенным поиском уже в GIPITI — свежие ответы со ссылками на источники. Без VPN, на русском, с оплатой российскими картами. Дарим 200 ₽ каждому новому пользователю.",
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
      sourcesBenefit,
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
  {
    kind: "text",
    slug: SONAR_PRO_SLUG,
    modelId: "sonar-pro",
    name: "Sonar Pro",
    vendor: "Perplexity",
    accent: "blue",
    badge: "Perplexity · Продвинутый поиск · Текст",
    h1Top: "Sonar Pro —",
    h1Gradient: "глубокий поиск с источниками",
    sub: "Продвинутая модель Perplexity со встроенным поиском уже в GIPITI — сложные запросы, подробные ответы и ссылки на источники. Без VPN, на русском, с оплатой российскими картами. Дарим 200 ₽ каждому новому пользователю.",
    ctaMain: "Попробовать Sonar Pro",
    metaTitle:
      "Perplexity Sonar Pro — поиск в интернете с источниками | GIPITI",
    metaDescription:
      "Perplexity Sonar Pro в GIPITI — продвинутый поиск в интернете: сложные запросы, подробные ответы со ссылками на источники. Без VPN, на русском, оплата российскими картами.",
    heroChat: {
      userMessage:
        "Сравни три CRM для малого бизнеса в России: цены, интеграции, поддержка",
      aiIntro:
        "Проверил актуальные тарифы и собрал сравнение по **9 критериям**:",
      aiBullets: [
        "**Цена за пользователя** — разброс от 490 до 1 490 ₽ в месяц [1][2]",
        "**Интеграции** — только у одной есть готовый обмен с 1С [3]",
        "**Поддержка** — круглосуточная линия заявлена у двух из трёх [1][4]",
      ],
    },
    benefits: [
      {
        icon: "search",
        title: "Глубже ищет по сложным темам",
        text: "Sonar Pro делает больше поисковых запросов на один вопрос и собирает ответ из большего числа источников — там, где обычного поиска не хватает.",
      },
      sourcesBenefit,
      {
        icon: "file-text",
        title: "Подробные ответы",
        text: "Не короткая справка, а разбор: сравнения, таблицы и списки с цифрами — материал, который можно сразу использовать в работе.",
      },
      vpnBenefit,
    ],
    steps: buildSteps(
      "Sonar Pro",
      "Сформулируйте вопрос на русском — модель сама найдёт свежие источники."
    ),
    audience: [
      {
        title: "Аналитики и консультанты",
        text: "Обзоры рынков и конкурентов по свежим данным — со ссылками, которые можно приложить к отчёту.",
        userMessage:
          "Собери обзор рынка электрозарядных станций в России за последний год",
        aiReply:
          "Собрал по **18 источникам**: число станций выросло, но темп замедлился во втором полугодии…",
      },
      {
        title: "Закупки и продакт-менеджеры",
        text: "Сравнение сервисов и поставщиков: цены, условия и подводные камни.",
        userMessage:
          "Сравни тарифы трёх облачных провайдеров для базы на 500 ГБ",
        aiReply:
          "Дешевле всего выходит вариант **с резервированием на год** — но там платный исходящий трафик…",
      },
      studentsAudience,
    ],
    faq: [
      {
        question: "Что такое Perplexity Sonar Pro?",
        answer:
          "Sonar Pro — продвинутая модель Perplexity со встроенным поиском: она обрабатывает сложные запросы и даёт подробные ответы со ссылками на источники. В GIPITI она доступна без VPN, с интерфейсом на русском языке и оплатой российскими картами.",
      },
      {
        question: "Чем Sonar Pro отличается от обычного Sonar?",
        answer:
          "Sonar Pro глубже прорабатывает запрос: делает больше поисковых обращений и отвечает подробнее. Обычный Sonar быстрее и дешевле — его достаточно для простых фактических вопросов. Обе модели доступны в GIPITI.",
      },
      sourcesFaq,
      ...sharedFaq,
    ],
    otherModels: [
      { name: "Sonar", tag: "Текст", href: `/models/${SONAR_SLUG}` },
      {
        name: "Sonar Reasoning Pro",
        tag: "Текст",
        href: `/models/${SONAR_REASONING_SLUG}`,
      },
      { name: "GPT-5.6 Sol", tag: "Текст", href: `/models/${SOL_SLUG}` },
      {
        name: "Gemini 3.1 Pro",
        tag: "Текст",
        href: `/models/${GEMINI_PRO_SLUG}`,
      },
    ],
  },
  {
    kind: "text",
    slug: SONAR_REASONING_SLUG,
    modelId: "sonar-reasoning-pro",
    name: "Sonar Reasoning Pro",
    vendor: "Perplexity",
    accent: "violet",
    badge: "Perplexity · Поиск и рассуждения · Текст",
    h1Top: "Sonar Reasoning Pro —",
    h1Gradient: "поиск с пошаговым разбором",
    sub: "Рассуждающая модель Perplexity со встроенным поиском уже в GIPITI — пошаговый анализ и выводы со ссылками на источники. Без VPN, на русском, с оплатой российскими картами. Дарим 200 ₽ каждому новому пользователю.",
    ctaMain: "Попробовать Sonar Reasoning Pro",
    metaTitle:
      "Sonar Reasoning Pro — нейросеть с поиском и рассуждениями | GIPITI",
    metaDescription:
      "Sonar Reasoning Pro в GIPITI — рассуждающая модель Perplexity со встроенным поиском: пошаговый анализ и выводы со ссылками на источники. Без VPN, оплата российскими картами.",
    heroChat: {
      userMessage:
        "Выгоднее сейчас брать ипотеку или копить на вклад? Разбери по шагам",
      aiIntro: "Нашёл актуальные ставки и посчитал. **Ход рассуждения**:",
      aiBullets: [
        "**Шаг 1** — сравнил ставки по вкладам и ипотеке на сегодня [1][2]",
        "**Шаг 2** — прикинул рост цен на жильё за последние периоды [3]",
        "**Вывод** — при вашем горизонте в 2 года вклад выигрывает, вот почему…",
      ],
    },
    benefits: [
      {
        icon: "sparkles",
        title: "Показывает ход мысли",
        text: "Модель не просто выдаёт вывод, а разбирает задачу по шагам — видно, на чём основан ответ и где он может быть спорным.",
      },
      {
        icon: "search",
        title: "Рассуждает по свежим данным",
        text: "Перед рассуждением модель ищет в интернете, поэтому опирается на актуальные цифры, а не на память с даты обучения.",
      },
      sourcesBenefit,
      vpnBenefit,
    ],
    steps: buildSteps(
      "Sonar Reasoning Pro",
      "Опишите задачу на русском — модель найдёт данные и разберёт её по шагам."
    ),
    audience: [
      {
        title: "Аналитики и финансисты",
        text: "Решения с обоснованием: свежие цифры плюс понятная логика расчёта.",
        userMessage:
          "Стоит ли выходить на маркетплейс с этой маржой? Посчитай по шагам",
        aiReply:
          "Считаю: комиссия площадки и логистика съедают **62% маржи** — при текущей цене выход в минус…",
      },
      {
        title: "Журналисты и исследователи",
        text: "Проверка утверждений: что говорят источники и где они противоречат друг другу.",
        userMessage:
          "Правда ли, что этот показатель вырос? Проверь и покажи расхождения",
        aiReply:
          "Данные расходятся: по одному источнику рост **8%**, по другому — падение. Причина в методике…",
      },
      studentsAudience,
    ],
    faq: [
      {
        question: "Что такое Sonar Reasoning Pro?",
        answer:
          "Sonar Reasoning Pro — рассуждающая модель Perplexity со встроенным поиском: она ищет данные в интернете и разбирает задачу по шагам, ссылаясь на источники. В GIPITI она доступна без VPN, с интерфейсом на русском языке и оплатой российскими картами.",
      },
      {
        question: "Чем она отличается от Sonar и Sonar Pro?",
        answer:
          "Главное отличие — пошаговые рассуждения: модель показывает, как пришла к выводу. Sonar и Sonar Pro отвечают короче и быстрее. Все три модели доступны в GIPITI — переключайтесь в один клик.",
      },
      {
        question: "Можно ли загрузить документ в Sonar Reasoning Pro?",
        answer:
          "Эта модель работает без вложений — вставьте нужный текст прямо в чат. Если требуется прочитать PDF или таблицу целиком, выберите GPT-5.6, Claude или Gemini: они доступны в той же подписке.",
      },
      sourcesFaq,
      vpnFaq,
      priceFaq,
    ],
    otherModels: [
      { name: "Sonar Pro", tag: "Текст", href: `/models/${SONAR_PRO_SLUG}` },
      { name: "Sonar", tag: "Текст", href: `/models/${SONAR_SLUG}` },
      { name: "Claude Opus 5", tag: "Текст", href: `/models/${OPUS_5_SLUG}` },
      { name: "GPT-5.6 Terra", tag: "Текст", href: `/models/${TERRA_SLUG}` },
    ],
  },
];
