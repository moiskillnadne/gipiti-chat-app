/** Landing for the Mistral AI text model: Mistral Large 4. */

import {
  buildSteps,
  GLM_53_SLUG,
  GPT61_TERRA_SLUG,
  MISTRAL_LARGE_4_SLUG,
  OPUS_55_SLUG,
  priceFaq,
  QWEN_38_MAX_SLUG,
  supportAudience,
  vpnBenefit,
  vpnFaq,
} from "./shared";
import type { ModelLanding } from "./types";

export const mistralLandings: ModelLanding[] = [
  {
    kind: "text",
    slug: MISTRAL_LARGE_4_SLUG,
    modelId: "mistral-large-4",
    name: "Mistral Large 4",
    vendor: "Mistral AI",
    accent: "warm",
    badge: "Mistral AI · Открытые веса · Текст",
    h1Top: "Mistral Large 4 —",
    h1Gradient: "европейская нейросеть на русском",
    sub: "Флагман французской Mistral AI уже в GIPITI — открытая мультимодальная модель с рассуждениями, которая понимает изображения любых пропорций. Без VPN, на русском, с оплатой российскими картами. Дарим 200 ₽ каждому новому пользователю.",
    ctaMain: "Попробовать Mistral Large 4",
    metaTitle: "Mistral Large 4 — нейросеть Mistral AI без VPN | GIPITI",
    metaDescription:
      "Mistral Large 4 в GIPITI — открытый мультимодальный флагман Mistral AI: рассуждения, текст и изображения в одном чате. Без VPN, на русском, оплата картами РФ.",
    heroChat: {
      userMessage:
        "Вот длинный скриншот нашего лендинга целиком — что мешает покупке? 📷 landing.png",
      aiIntro: "Просмотрел страницу сверху донизу. **Три стоп-фактора**:",
      aiBullets: [
        "**Цена** спрятана в самом низу, после блока отзывов",
        "**Форма заявки** просит 9 полей — хватит трёх",
        "**Отзывы** без имён и фото — им трудно поверить",
      ],
    },
    benefits: [
      {
        icon: "layers",
        title: "Архитектура Mixture-of-Experts",
        text: "Около триллиона параметров, но на каждый токен работает лишь малая часть — примерно 50 млрд. Знания большой модели без лишних вычислений на каждом шаге.",
      },
      {
        icon: "image",
        title: "Видит картинки любых пропорций",
        text: "Собственный визуальный энкодер Mistral работает с изображениями разного размера и формата: длинные скриншоты, широкие схемы, вертикальные фото.",
      },
      {
        icon: "globe",
        title: "Открытые веса",
        text: "Mistral Large 4 — открытый (open-weight) флагман: веса модели можно скачать и запустить у себя. В GIPITI ничего разворачивать не нужно: она работает прямо в чате.",
      },
      vpnBenefit,
    ],
    steps: buildSteps(
      "Mistral Large 4",
      "Текстом на русском — или прикрепите изображение, скриншот или файл Word."
    ),
    audience: [
      {
        title: "Дизайнеры и продакт-менеджеры",
        text: "Разбор макетов, интерфейсов и лендингов по скриншотам — замечания по делу, а не общие слова.",
        userMessage: "Оцени этот экран онбординга 📷 onboarding.png",
        aiReply:
          "Главная проблема — **три кнопки одинакового веса**: непонятно, что нажимать первым…",
      },
      {
        title: "Аналитики",
        text: "Графики и дашборды со скриншота — модель прочитает цифры и сформулирует выводы.",
        userMessage:
          "Что показывает этот дашборд за сентябрь? 📷 dashboard.png",
        aiReply:
          "Выручка выросла на **8%**, но почти вся прибавка пришлась на один канал — контекстную рекламу…",
      },
      supportAudience,
    ],
    faq: [
      {
        question: "Что такое Mistral Large 4?",
        answer:
          "Mistral Large 4 — флагманская модель французской компании Mistral AI с открытыми весами. Она мультимодальная от рождения: понимает текст и изображения и умеет рассуждать перед ответом. Публичная превью-версия вышла 6 октября 2026 года. В GIPITI модель доступна без VPN, на русском и с оплатой российскими картами.",
      },
      {
        question: "Что значит «открытые веса»?",
        answer:
          "Mistral выкладывает саму модель, а не только платный доступ к ней: компании могут запускать её на своих серверах и дообучать под себя. Чтобы просто пользоваться Mistral Large 4, разворачивать ничего не нужно — в GIPITI она уже работает в чате.",
      },
      {
        question: "Чем Mistral Large 4 отличается от GPT и Claude?",
        answer:
          "Mistral Large 4 — открытый (open-weight) флагман Mistral AI: веса модели можно скачать и запустить у себя. Она построена по схеме Mixture-of-Experts: из примерно триллиона параметров на каждый токен задействуется около 50 млрд. Сравнить ответы удобно прямо в GIPITI — переключите модель на GPT-6.1 Terra или Claude Opus 5.5 в том же чате.",
      },
      {
        question: "Можно ли прикреплять файлы?",
        answer:
          "Да — изображения любых пропорций и файлы Word. PDF лучше отдать Gemini, GPT-6 или Claude: они читают такие документы напрямую.",
      },
      vpnFaq,
      priceFaq,
    ],
    otherModels: [
      { name: "GLM-5.3", tag: "Текст", href: `/models/${GLM_53_SLUG}` },
      {
        name: "Qwen 3.8 Max",
        tag: "Текст",
        href: `/models/${QWEN_38_MAX_SLUG}`,
      },
      {
        name: "GPT-6.1 Terra",
        tag: "Текст",
        href: `/models/${GPT61_TERRA_SLUG}`,
      },
      {
        name: "Claude Opus 5.5",
        tag: "Текст",
        href: `/models/${OPUS_55_SLUG}`,
      },
    ],
  },
];
