/** Landings for the Alibaba Qwen text models: 3.8 Max and 3.7 Flash. */

import {
  analystsAudience,
  buildSteps,
  GEMINI_37_FLASH_SLUG,
  GROK_46_SLUG,
  KIMI_K3_FAST_SLUG,
  lawyersAudience,
  OPUS_5_SLUG,
  QWEN_37_FLASH_SLUG,
  QWEN_38_MAX_SLUG,
  sharedFaq,
  supportAudience,
  TERRA_SLUG,
  vpnBenefit,
} from "./shared";
import type { LandingBenefit, ModelLanding } from "./types";

/** Both Qwen models take images but reject PDFs, so the copy never claims them. */
const imageInputBenefit: LandingBenefit = {
  icon: "image",
  title: "Понимает изображения",
  text: "Прикрепите скриншот, фотографию документа или схему — модель разберётся, что на картинке, и ответит по существу.",
};

export const alibabaLandings: ModelLanding[] = [
  {
    kind: "text",
    slug: QWEN_38_MAX_SLUG,
    modelId: "qwen3.8-max",
    name: "Qwen 3.8 Max",
    vendor: "Alibaba",
    accent: "warm",
    badge: "Alibaba · Флагман Qwen · Текст",
    h1Top: "Qwen 3.8 Max —",
    h1Gradient: "флагманская нейросеть Alibaba",
    sub: "Старшая модель Qwen уже в GIPITI — доводит до конца большие задачи в коде, праве, финансах и дизайне, а не отвечает обрывками. Без VPN, на русском, с оплатой российскими картами. Дарим 200 ₽ каждому новому пользователю.",
    ctaMain: "Попробовать Qwen 3.8 Max",
    metaTitle:
      "Qwen 3.8 Max — флагманская нейросеть Alibaba на русском без VPN | GIPITI",
    metaDescription:
      "Qwen 3.8 Max — флагман Alibaba в GIPITI: программирование, длинные документы и профессиональные задачи от начала до конца. Без VPN, на русском, оплата российскими картами.",
    heroChat: {
      userMessage:
        "Нужен разбор договора поставки: риски, спорные пункты и что просить изменить",
      aiIntro: "Разобрал по пунктам. **Четыре места требуют правок**:",
      aiBullets: [
        "**П. 5.3** — неустойка односторонняя, встречной для поставщика нет",
        "**П. 7.1** — срок приёмки 3 дня, для вашего объёма нереалистичен",
        "**Что просить** — симметричная неустойка и приёмка в 10 рабочих дней",
      ],
    },
    benefits: [
      {
        icon: "sparkles",
        title: "Доводит задачу до результата",
        text: "Qwen 3.8 Max рассчитана на длинную работу: планирует, выполняет, проверяет себя и выдаёт готовый результат, а не набросок.",
      },
      {
        icon: "code",
        title: "Сильна в программировании",
        text: "Собирает проекты целиком: от структуры и кода до тестов и объяснения принятых решений.",
      },
      imageInputBenefit,
      vpnBenefit,
    ],
    steps: buildSteps(
      "Qwen 3.8 Max",
      "Текстом на русском — или прикрепите изображение либо код."
    ),
    audience: [lawyersAudience, analystsAudience, supportAudience],
    faq: [
      {
        question: "Что такое Qwen 3.8 Max?",
        answer:
          "Qwen 3.8 Max — флагманская модель Alibaba. Она рассчитана на длинные профессиональные задачи: программирование, работу с объёмными документами, юридический и финансовый анализ. В GIPITI доступна без VPN, на русском и с оплатой российскими картами.",
      },
      {
        question: "Можно ли прикреплять документы?",
        answer:
          "Модель понимает изображения и файлы Word. PDF она не читает — для таких документов в GIPITI есть Gemini, GPT-5.6 и Claude, они разбирают PDF напрямую.",
      },
      {
        question: "Чем Qwen 3.8 Max отличается от Qwen 3.7 Flash?",
        answer:
          "Max — старшая модель: глубже рассуждает и лучше держит длинные многошаговые задачи. Flash быстрее и дешевле, её стоит выбирать для частых повседневных запросов.",
      },
      ...sharedFaq,
    ],
    otherModels: [
      {
        name: "Qwen 3.7 Flash",
        tag: "Текст",
        href: `/models/${QWEN_37_FLASH_SLUG}`,
      },
      {
        name: "Kimi K3 Fast",
        tag: "Текст",
        href: `/models/${KIMI_K3_FAST_SLUG}`,
      },
      { name: "Claude Opus 5", tag: "Текст", href: `/models/${OPUS_5_SLUG}` },
      { name: "Grok 4.6", tag: "Текст", href: `/models/${GROK_46_SLUG}` },
    ],
  },
  {
    kind: "text",
    slug: QWEN_37_FLASH_SLUG,
    modelId: "qwen3.7-flash",
    name: "Qwen 3.7 Flash",
    vendor: "Alibaba",
    accent: "emerald",
    badge: "Alibaba · Быстрая модель · Текст",
    h1Top: "Qwen 3.7 Flash —",
    h1Gradient: "быстрая нейросеть Alibaba на русском",
    sub: "Быстрая мультимодальная модель Alibaba уже в GIPITI — понимает текст и изображения, отвечает мгновенно и стоит копейки. Без VPN, на русском, с оплатой российскими картами. Дарим 200 ₽ каждому новому пользователю.",
    ctaMain: "Попробовать Qwen 3.7 Flash",
    metaTitle:
      "Qwen 3.7 Flash — быстрая нейросеть Alibaba на русском без VPN | GIPITI",
    metaDescription:
      "Qwen 3.7 Flash — быстрая мультимодальная модель Alibaba в GIPITI: текст, изображения и агентные сценарии по низкой цене. Без VPN, на русском, оплата российскими картами.",
    heroChat: {
      userMessage:
        "Что не так с этим экраном? Прикладываю скриншот формы оплаты",
      aiIntro: "Посмотрел на макет. **Три проблемы, все на виду**:",
      aiBullets: [
        "**Кнопка оплаты** теряется — она серая рядом с яркой «Отмена»",
        "**Поле карты** без маски: непонятно, где ставить пробелы",
        "**Итоговая сумма** ниже сгиба, её не видно без прокрутки",
      ],
    },
    benefits: [
      {
        icon: "zap",
        title: "Мгновенные ответы",
        text: "Qwen 3.7 Flash отвечает почти без задержки — удобно для коротких вопросов, переписки и десятков однотипных задач подряд.",
      },
      imageInputBenefit,
      {
        icon: "wallet",
        title: "Одна из самых недорогих",
        text: "Стоимость запроса — доли копейки, поэтому модель не жалко использовать для черновиков и рутины.",
      },
      vpnBenefit,
    ],
    steps: buildSteps(
      "Qwen 3.7 Flash",
      "Текстом на русском — или прикрепите изображение."
    ),
    audience: [
      {
        title: "Дизайнеры и продакты",
        text: "Разбор макетов и скриншотов: что мешает пользователю и как это исправить.",
        userMessage: "Оцени этот экран онбординга — что сбивает с толку?",
        aiReply:
          "Главное — **три действия на одном экране**. Пользователь не понимает, с чего начать…",
      },
      {
        title: "Поддержка и операционка",
        text: "Быстрые ответы, шаблоны писем и разбор скриншотов от клиентов.",
        userMessage: "Клиент прислал скрин ошибки — объясни, что ему ответить",
        aiReply:
          "На скрине **ошибка 402** — не прошла оплата. Напишите так: «Здравствуйте! Платёж отклонён банком…»",
      },
      {
        title: "Все, кому нужен быстрый черновик",
        text: "Письма, описания и заметки — за секунды и почти бесплатно.",
        userMessage: "Набросай письмо клиенту о переносе сроков на неделю",
        aiReply:
          "Готово. «Здравствуйте! Сообщаем, что срок сдачи сдвигается на неделю — до…»",
      },
    ],
    faq: [
      {
        question: "Что такое Qwen 3.7 Flash?",
        answer:
          "Qwen 3.7 Flash — быстрая мультимодальная модель Alibaba. Она понимает текст и изображения, отвечает почти мгновенно и стоит очень дёшево. В GIPITI доступна без VPN, на русском и с оплатой российскими картами.",
      },
      {
        question: "Можно ли прикреплять документы?",
        answer:
          "Модель понимает изображения и файлы Word. PDF она не читает — для таких документов возьмите Gemini, GPT-5.6 или Claude.",
      },
      {
        question: "Когда лучше взять Qwen 3.8 Max?",
        answer:
          "Когда задача большая и требует глубокого разбора: сложный код, объёмный документ или многошаговый анализ. Для коротких повседневных запросов быстрее и дешевле Flash.",
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
        name: "Gemini 3.7 Flash",
        tag: "Текст",
        href: `/models/${GEMINI_37_FLASH_SLUG}`,
      },
      {
        name: "Kimi K3 Fast",
        tag: "Текст",
        href: `/models/${KIMI_K3_FAST_SLUG}`,
      },
      { name: "GPT-5.6 Terra", tag: "Текст", href: `/models/${TERRA_SLUG}` },
    ],
  },
];
