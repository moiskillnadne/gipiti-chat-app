/**
 * Landings for DeepSeek V4.1 Flash, V4 Pro and V4 Flash.
 *
 * Note: V4 Pro and V4 Flash have no attachments capability in the registry,
 * so their copy deliberately avoids "upload a document" claims — users paste
 * text instead. V4.1 Flash reads images (photos, screenshots) but the gateway
 * drops PDF parts for it, so its copy claims photos only. The shared documents
 * FAQ is replaced with a context-size or attachments one on every landing.
 */

import {
  buildSteps,
  DEEPSEEK_41_FLASH_SLUG,
  DEEPSEEK_FLASH_SLUG,
  DEEPSEEK_SLUG,
  GEMINI_38_FLASH_SLUG,
  LUNA_SLUG,
  priceFaq,
  SONAR_SLUG,
  SONNET_SLUG,
  studentsAudience,
  supportAudience,
  TERRA_SLUG,
  vpnBenefit,
  vpnFaq,
} from "./shared";
import type { LandingFaqItem, ModelLanding } from "./types";

/** DeepSeek models take no attachments — the FAQ says so and points elsewhere. */
const attachmentsFaq: LandingFaqItem = {
  question: "Можно ли загрузить документ в DeepSeek?",
  answer:
    "Модели DeepSeek работают без вложений — вставьте текст прямо в чат. Если нужно прочитать PDF, Word или таблицу целиком, выберите GPT-5.6, Claude или Gemini: они доступны в той же подписке.",
};

/** V4.1 Flash takes photos and screenshots, but no PDF/Word/tables. */
const photosOnlyFaq: LandingFaqItem = {
  question: "Можно ли загрузить документ в DeepSeek V4.1 Flash?",
  answer:
    "Модель читает изображения — прикрепите фото, скриншот или снимок страницы. PDF, Word и таблицы она пока не принимает: вставьте текст прямо в чат или выберите GPT-5.6, Claude или Gemini — они доступны в той же подписке.",
};

const contextFaq: LandingFaqItem = {
  question: "Какой размер контекста у DeepSeek V4 Pro?",
  answer:
    "До миллиона токенов — это сотни страниц текста или целая кодовая база. Вставьте материал прямо в чат — модель удержит всё и не потеряет деталей.",
};

export const deepseekLandings: ModelLanding[] = [
  {
    kind: "text",
    slug: DEEPSEEK_41_FLASH_SLUG,
    modelId: "deepseek-v4.1-flash",
    name: "DeepSeek V4.1 Flash",
    vendor: "DeepSeek",
    accent: "blue",
    badge: "DeepSeek · Новая быстрая модель · Текст",
    h1Top: "DeepSeek V4.1 Flash\u00A0—",
    h1Gradient: "быстрая нейросеть с пониманием фото",
    sub: "Новое поколение быстрой модели DeepSeek уже в GIPITI — рассуждения, работа с фото и скриншотами и низкая цена запроса. Без VPN, на русском, с оплатой российскими картами. Дарим 200 ₽ каждому новому пользователю.",
    ctaMain: "Попробовать V4.1 Flash",
    metaTitle:
      "DeepSeek V4.1 Flash — быстрая нейросеть DeepSeek на русском | GIPITI",
    metaDescription:
      "DeepSeek V4.1 Flash в GIPITI — новая быстрая модель DeepSeek с рассуждениями и пониманием изображений по минимальной цене. Без VPN, на русском, оплата российскими картами.",
    heroChat: {
      userMessage:
        "Вот скриншот ошибки из консоли — что сломалось и как починить? 📷 error.png",
      aiIntro: "Разобрал скриншот. Причина — **несовпадение версий**:",
      aiBullets: [
        "**Ошибка** — клиент ждёт API v2, а сервер отвечает по v1",
        "**Решение** — обновить клиент до 2.x или указать версию в запросе",
        "**Проверка** — перезапустите сборку и повторите запрос",
      ],
    },
    benefits: [
      {
        icon: "zap",
        title: "Быстрые ответы с рассуждением",
        text: "V4.1 Flash отвечает почти сразу, но рассуждает над задачей — новая архитектура даёт точнее ответы при меньшей нагрузке и цене.",
      },
      {
        icon: "image",
        title: "Понимает фото и скриншоты",
        text: "Первая быстрая модель DeepSeek со зрением: прикрепите скриншот ошибки, фото документа или график — модель разберёт содержимое и ответит по существу.",
      },
      {
        icon: "wallet",
        title: "Минимальная цена запроса",
        text: "Одна из самых доступных моделей в GIPITI: стартовых 200 ₽ и месячного баланса подписки хватает надолго.",
      },
      vpnBenefit,
    ],
    steps: buildSteps(
      "DeepSeek V4.1 Flash",
      "Текстом на русском — или прикрепите фото или скриншот."
    ),
    audience: [
      {
        title: "Разработчики",
        text: "Скриншоты ошибок, логи и фрагменты кода — быстрый разбор без ожидания длинного ответа.",
        userMessage: "Что не так с этим стектрейсом? 📷 trace.png",
        aiReply:
          "Падает на **десериализации даты**: поле приходит строкой, а парсер ждёт число…",
      },
      supportAudience,
      {
        title: "Студенты и исследователи",
        text: "Сфотографируйте задачу или страницу конспекта — модель объяснит решение на вашем уровне.",
        userMessage: "Объясни решение этой задачи по шагам 📷 zadacha.jpg",
        aiReply:
          "Это уравнение на **теорему Виета**. Сначала найдём сумму и произведение корней…",
      },
    ],
    faq: [
      {
        question: "Что такое DeepSeek V4.1 Flash?",
        answer:
          "DeepSeek V4.1 Flash — новая быстрая модель DeepSeek на обновлённой архитектуре: рассуждения, понимание изображений и низкая цена запроса. В GIPITI она доступна без VPN, с интерфейсом на русском языке и оплатой российскими картами.",
      },
      {
        question: "Чем V4.1 Flash отличается от V4 Flash?",
        answer:
          "V4.1 Flash понимает изображения — V4 Flash работала только с текстом. Кроме того, новая архитектура отвечает быстрее и точнее при меньшей нагрузке. Обе модели доступны в GIPITI — переключайтесь в один клик.",
      },
      {
        question: "Подойдёт ли V4.1 Flash для сложных задач?",
        answer:
          "Для глубокой аналитики, больших кодовых баз и контекста до миллиона токенов лучше выбрать DeepSeek V4 Pro или другой флагман. V4.1 Flash сильна там, где важны скорость и цена: переписка, скриншоты, выжимки и быстрые правки.",
      },
      vpnFaq,
      priceFaq,
      photosOnlyFaq,
    ],
    otherModels: [
      {
        name: "DeepSeek V4 Pro",
        tag: "Текст",
        href: `/models/${DEEPSEEK_SLUG}`,
      },
      {
        name: "DeepSeek V4 Flash",
        tag: "Текст",
        href: `/models/${DEEPSEEK_FLASH_SLUG}`,
      },
      {
        name: "Gemini 3.8 Flash",
        tag: "Текст",
        href: `/models/${GEMINI_38_FLASH_SLUG}`,
      },
      { name: "GPT-5.6 Luna", tag: "Текст", href: `/models/${LUNA_SLUG}` },
    ],
  },
  {
    kind: "text",
    slug: DEEPSEEK_SLUG,
    modelId: "deepseek-v4-pro",
    name: "DeepSeek V4 Pro",
    vendor: "DeepSeek",
    accent: "blue",
    badge: "DeepSeek · Флагман линейки · Текст",
    h1Top: "DeepSeek V4 Pro —",
    h1Gradient: "рассуждающая нейросеть на русском",
    sub: "Флагман DeepSeek уже в GIPITI — глубокие рассуждения и контекст до миллиона токенов по разумной цене. Без VPN, на русском, с оплатой российскими картами. Дарим 200 ₽ каждому новому пользователю.",
    ctaMain: "Попробовать DeepSeek V4 Pro",
    metaTitle:
      "DeepSeek V4 Pro — нейросеть DeepSeek на русском без VPN | GIPITI",
    metaDescription:
      "DeepSeek V4 Pro в GIPITI — глубокие рассуждения и контекст до миллиона токенов по разумной цене. Без VPN, на русском, оплата российскими картами. Дарим 200 ₽ каждому новому пользователю.",
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
      {
        name: "DeepSeek V4.1 Flash",
        tag: "Текст",
        href: `/models/${DEEPSEEK_41_FLASH_SLUG}`,
      },
    ],
  },
  {
    kind: "text",
    slug: DEEPSEEK_FLASH_SLUG,
    modelId: "deepseek-v4-flash",
    name: "DeepSeek V4 Flash",
    vendor: "DeepSeek",
    accent: "sky",
    badge: "DeepSeek · Быстрая и недорогая · Текст",
    h1Top: "DeepSeek V4 Flash —",
    h1Gradient: "быстрая нейросеть на русском",
    sub: "Быстрая версия DeepSeek V4 уже в GIPITI — рассуждения и повседневные задачи по минимальной цене запроса. Без VPN, на русском, с оплатой российскими картами. Дарим 200 ₽ каждому новому пользователю.",
    ctaMain: "Попробовать DeepSeek V4 Flash",
    metaTitle: "DeepSeek V4 Flash — быстрая нейросеть DeepSeek | GIPITI",
    metaDescription:
      "DeepSeek V4 Flash в GIPITI — быстрая и доступная версия DeepSeek V4 с рассуждениями для повседневных задач. Без VPN, на русском, оплата российскими картами.",
    heroChat: {
      userMessage:
        "Вставил переписку с подрядчиком — о чём договорились и что я должен сделать?",
      aiIntro: "Разобрал переписку. **Ваши задачи** — три:",
      aiBullets: [
        "**До пятницы** — прислать финальные макеты и брендбук",
        "**Оплата** — 50% аванса после подписания, остальное по акту",
        "**Спорный момент** — срок правок не зафиксирован, стоит уточнить",
      ],
    },
    benefits: [
      {
        icon: "zap",
        title: "Быстрые ответы с рассуждением",
        text: "Flash отвечает почти сразу, но всё равно рассуждает над задачей — хороший баланс для переписки, выжимок и повседневных вопросов.",
      },
      {
        icon: "wallet",
        title: "Минимальная цена запроса",
        text: "Одна из самых доступных моделей в GIPITI: стартовых 200 ₽ и месячного баланса подписки хватает надолго.",
      },
      {
        icon: "file-text",
        title: "Держит длинный контекст",
        text: "Вставьте переписку, статью или большой фрагмент кода прямо в чат — модель удержит детали и не потеряет нить разговора.",
      },
      vpnBenefit,
    ],
    steps: buildSteps(
      "DeepSeek V4 Flash",
      "Текстом на русском — вставьте вопрос, код или фрагмент текста прямо в чат."
    ),
    audience: [
      supportAudience,
      {
        title: "Разработчики",
        text: "Быстрые вопросы по коду и разбор ошибок — без ожидания длинного ответа.",
        userMessage: "Объясни, что делает эта регулярка, и упрости её",
        aiReply:
          "Она ищет дату в формате ДД.ММ.ГГГГ. Упростить можно так — **без лишних групп**…",
      },
      studentsAudience,
    ],
    faq: [
      {
        question: "Что такое DeepSeek V4 Flash?",
        answer:
          "DeepSeek V4 Flash — быстрая и доступная версия DeepSeek V4 с рассуждениями для повседневных задач. В GIPITI она доступна без VPN, с интерфейсом на русском языке и оплатой российскими картами.",
      },
      {
        question: "Чем V4 Flash отличается от V4 Pro?",
        answer:
          "Flash — скорость и цена: мгновенные ответы на повседневные вопросы. Pro — глубина: максимальные рассуждения и контекст до миллиона токенов. Обе модели доступны в GIPITI — переключайтесь в один клик.",
      },
      {
        question: "Подойдёт ли Flash для сложных задач?",
        answer:
          "Для сложной аналитики, больших кодовых баз и длинных документов лучше выбрать V4 Pro или другой флагман. Flash сильна там, где важны скорость и цена: переписка, выжимки, быстрые правки.",
      },
      {
        question: "Стоит ли перейти на DeepSeek V4.1 Flash?",
        answer:
          "Если нужны изображения — да: V4.1 Flash читает фото и скриншоты, а V4 Flash работает только с текстом. Новая версия к тому же быстрее и точнее. Обе модели доступны в GIPITI, переключение занимает один клик.",
      },
      vpnFaq,
      priceFaq,
      attachmentsFaq,
    ],
    otherModels: [
      {
        name: "DeepSeek V4 Pro",
        tag: "Текст",
        href: `/models/${DEEPSEEK_SLUG}`,
      },
      {
        name: "DeepSeek V4.1 Flash",
        tag: "Текст",
        href: `/models/${DEEPSEEK_41_FLASH_SLUG}`,
      },
      { name: "GPT-5.6 Luna", tag: "Текст", href: `/models/${LUNA_SLUG}` },
      { name: "Claude Sonnet 5", tag: "Текст", href: `/models/${SONNET_SLUG}` },
    ],
  },
];
