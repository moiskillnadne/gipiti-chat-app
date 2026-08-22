/**
 * Landings for the ByteDance video models: Seedance 2.5, 2.0 and 2.0 Fast.
 *
 * Registry facts the copy follows: 5- or 10-second clips, six aspect ratios
 * and an optional image input (text-to-video or image-to-video).
 */

import {
  buildChips,
  buildVideoSteps,
  mediaHistoryFaq,
  sharedMediaFaq,
} from "./media-shared";
import {
  KLING_25_TURBO_SLUG,
  KLING_30_SLUG,
  SEEDANCE_25_SLUG,
  SEEDANCE_FAST_SLUG,
  SEEDANCE_SLUG,
  SEEDREAM_45_SLUG,
  VEO_SLUG,
  vpnBenefit,
} from "./shared";
import type { LandingBenefit, ModelLanding } from "./types";

const imageInputBenefit: LandingBenefit = {
  icon: "image",
  title: "По тексту или из картинки",
  text: "Опишите сцену словами — или прикрепите изображение, и модель оживит его. Работают оба сценария, выбирать заранее не нужно.",
};

const aspectBenefit: LandingBenefit = {
  icon: "ratio",
  title: "Шесть форматов, 5 или 10 секунд",
  text: "От вертикального 9:16 под сторис до широкого 21:9 — формат и длительность выбираются прямо в чате.",
};

export const bytedanceVideoLandings: ModelLanding[] = [
  {
    kind: "video",
    slug: SEEDANCE_25_SLUG,
    modelId: "seedance-2.5",
    name: "Seedance 2.5",
    vendor: "ByteDance",
    accent: "violet",
    badge: "ByteDance · Новое поколение · Видео",
    h1Top: "Seedance 2.5 —",
    h1Gradient: "новое поколение видео со звуком",
    sub: "Новейшая видеомодель ByteDance уже в GIPITI — ролики со звуком по описанию или из вашего изображения, с точным контролем сцены и связным повествованием. Без VPN, с оплатой российскими картами. Дарим 200 ₽ каждому новому пользователю.",
    ctaMain: "Попробовать Seedance 2.5",
    metaTitle: "Seedance 2.5 — нейросеть для генерации видео | GIPITI",
    metaDescription:
      "Seedance 2.5 в GIPITI — новое поколение генерации видео со звуком по тексту или из изображения, точный контроль сцены. Без VPN, на русском, оплата российскими картами.",
    heroMedia: {
      userMessage:
        "Ролик: бариста готовит кофе, пар над чашкой, тёплый свет, 16:9",
      aiIntro: "Готово — **тёплый свет** и пар над чашкой:",
      aspect: "16:9",
      resultCaption: "Бариста готовит кофе · пар, тёплый свет",
      resultMeta: "5 секунд · 16:9 · со звуком",
    },
    benefits: [
      {
        icon: "sparkles",
        title: "Связная сцена, а не набор кадров",
        text: "Seedance 2.5 создавалась под повествование: движение камеры, действия в кадре и звук складываются в одну историю, а не распадаются на куски.",
      },
      imageInputBenefit,
      aspectBenefit,
      vpnBenefit,
    ],
    steps: buildVideoSteps("Seedance 2.5"),
    audience: [
      {
        title: "Реклама и товары",
        text: "Продуктовые ролики с понятным сюжетом: распаковка, демонстрация, финальный кадр.",
        userMessage: "Часы на столе, камера медленно приближается, мягкий свет",
        aiReply: "**Ролик** · наезд камеры на часы, мягкий свет",
      },
      {
        title: "Соцсети и блоги",
        text: "Вертикальные ролики под сторис и клипы — сразу в нужном формате.",
        userMessage: "Городская улица под дождём, неон, вертикальный кадр 9:16",
        aiReply: "**Вертикальный ролик** · дождь и неон, 9:16",
      },
      {
        title: "Авторы контента",
        text: "Оживить готовый кадр: добавить движение, атмосферу и звук.",
        userMessage: "Оживи это фото: пусть волны набегают на берег 📎 sea.jpg",
        aiReply: "**Кадр ожил** · волны набегают на берег",
      },
    ],
    faq: [
      {
        question: "Что такое Seedance 2.5?",
        answer:
          "Seedance 2.5 — новое поколение видеомодели ByteDance: генерирует видео со звуком по текстовому описанию или из загруженного изображения, точнее держит сцену и связнее выстраивает действие. В GIPITI доступна без VPN и с оплатой российскими картами.",
      },
      {
        question: "Чем Seedance 2.5 отличается от 2.0?",
        answer:
          "2.5 лучше держит замысел сцены и связность действия, аккуратнее работает с референсами. Seedance 2.0 и её версия Fast остаются доступнее по цене — все три модели есть в GIPITI.",
      },
      {
        question: "Можно ли сделать ролик из своей картинки?",
        answer:
          "Да. Прикрепите изображение и опишите движение — модель оживит кадр. Без вложения она сгенерирует видео по одному текстовому описанию.",
      },
      ...sharedMediaFaq,
    ],
    otherModels: buildChips([
      { name: "Seedance 2.0", tag: "Видео", slug: SEEDANCE_SLUG },
      { name: "Veo 3.1", tag: "Видео", slug: VEO_SLUG },
      { name: "Kling 3.0", tag: "Видео", slug: KLING_30_SLUG },
      { name: "Seedream 4.5", tag: "Изображения", slug: SEEDREAM_45_SLUG },
    ]),
  },
  {
    kind: "video",
    slug: SEEDANCE_SLUG,
    modelId: "seedance-2.0",
    name: "Seedance 2.0",
    vendor: "ByteDance",
    accent: "rose",
    badge: "ByteDance · Мультимодальная · Видео",
    h1Top: "Seedance 2.0 —",
    h1Gradient: "видео со звуком по тексту и картинке",
    sub: "Мультимодальная видеомодель ByteDance уже в GIPITI — ролики со звуком по описанию или из вашего изображения, с реалистичной физикой движения. Без VPN, с оплатой российскими картами. Дарим 200 ₽ каждому новому пользователю.",
    ctaMain: "Попробовать Seedance 2.0",
    metaTitle: "Seedance 2.0 — нейросеть для генерации видео | GIPITI",
    metaDescription:
      "Seedance 2.0 в GIPITI — генерация видео со звуком по тексту или из изображения, реалистичная физика движения. Без VPN, на русском, оплата российскими картами.",
    heroMedia: {
      userMessage:
        "Ролик: мяч падает на воду и поднимает брызги, замедленная съёмка, 16:9",
      aiIntro: "Готово — **замедленная съёмка** с брызгами:",
      aspect: "16:9",
      resultCaption: "Мяч падает в воду · брызги, замедленная съёмка",
      resultMeta: "5 секунд · 16:9 · со звуком",
    },
    benefits: [
      {
        icon: "sparkles",
        title: "Реалистичная физика движения",
        text: "Ткань, вода, волосы и падающие предметы ведут себя правдоподобно — Seedance 2.0 особенно сильна в динамичных сценах.",
      },
      imageInputBenefit,
      aspectBenefit,
      vpnBenefit,
    ],
    steps: buildVideoSteps("Seedance 2.0"),
    audience: [
      {
        title: "Реклама и товары",
        text: "Динамичные ролики с предметами: разлив, всплеск, падение, распаковка.",
        userMessage: "Молоко льётся в стакан крупным планом, замедленно",
        aiReply: "**Ролик** · молоко льётся крупным планом, слоу-мо",
      },
      {
        title: "Спорт и активности",
        text: "Сцены с движением, где важна достоверная механика тела и предметов.",
        userMessage: "Бегун стартует с колодок, камера сбоку, утро",
        aiReply: "**Сцена** · старт с колодок, камера сбоку",
      },
      {
        title: "Авторы контента",
        text: "Оживить готовый кадр или собрать ролик под ленту — из текста или картинки.",
        userMessage:
          "Оживи это фото: пусть листья кружатся на ветру 📎 park.jpg",
        aiReply: "**Кадр ожил** · листья кружатся на ветру",
      },
    ],
    faq: [
      {
        question: "Что такое Seedance 2.0?",
        answer:
          "Seedance 2.0 — мультимодальная модель ByteDance для генерации видео: работает по текстовому описанию и по загруженному изображению, добавляет звук. В GIPITI она доступна без VPN и с оплатой российскими картами.",
      },
      {
        question: "Чем Seedance 2.0 отличается от версии Fast?",
        answer:
          "Fast — та же модель в ускоренном варианте: дешевле и быстрее, но с чуть меньшей проработкой кадра. Обе версии доступны в GIPITI — начните с Fast и повторите удачный кадр в обычной.",
      },
      {
        question: "Можно ли сделать ролик из своей картинки?",
        answer:
          "Да. Прикрепите изображение и опишите движение — модель оживит кадр. Без вложения она сгенерирует видео по одному текстовому описанию.",
      },
      ...sharedMediaFaq,
    ],
    otherModels: buildChips([
      { name: "Seedance 2.0 Fast", tag: "Видео", slug: SEEDANCE_FAST_SLUG },
      { name: "Veo 3.1", tag: "Видео", slug: VEO_SLUG },
      { name: "Kling 3.0", tag: "Видео", slug: KLING_30_SLUG },
      { name: "Seedream 4.5", tag: "Изображения", slug: SEEDREAM_45_SLUG },
    ]),
  },
  {
    kind: "video",
    slug: SEEDANCE_FAST_SLUG,
    modelId: "seedance-2.0-fast",
    name: "Seedance 2.0 Fast",
    vendor: "ByteDance",
    accent: "warm",
    badge: "ByteDance · Быстро и дешевле · Видео",
    h1Top: "Seedance 2.0 Fast —",
    h1Gradient: "быстрая генерация видео",
    sub: "Ускоренная версия Seedance 2.0 уже в GIPITI — те же возможности по тексту и картинке, только быстрее и дешевле. Без VPN, с оплатой российскими картами. Дарим 200 ₽ каждому новому пользователю.",
    ctaMain: "Попробовать Seedance 2.0 Fast",
    metaTitle: "Seedance 2.0 Fast — быстрая генерация видео | GIPITI",
    metaDescription:
      "Seedance 2.0 Fast в GIPITI — быстрая и недорогая генерация видео по тексту или из изображения. Без VPN, на русском, оплата российскими картами.",
    heroMedia: {
      userMessage: "Проверь идею: бумажный самолётик летит через офис, 9:16",
      aiIntro: "Черновик готов — если нравится, повторим в обычной версии:",
      aspect: "9:16",
      resultCaption: "Бумажный самолётик в офисе · вертикальный кадр",
      resultMeta: "5 секунд · 9:16",
    },
    benefits: [
      {
        icon: "zap",
        title: "Быстрее и дешевле",
        text: "Та же модель в ускоренном режиме: ролик приходит раньше и стоит меньше — удобно проверять идеи пачками.",
      },
      imageInputBenefit,
      aspectBenefit,
      vpnBenefit,
    ],
    steps: buildVideoSteps("Seedance 2.0 Fast"),
    audience: [
      {
        title: "Черновики и тесты",
        text: "Проверить сцену и ракурс, прежде чем запускать старшую модель.",
        userMessage: "Черновик: дрон облетает башню, вечер",
        aiReply: "**Черновик** · облёт башни, вечерний свет",
      },
      {
        title: "Соцсети каждый день",
        text: "Поток коротких роликов под ленту без заметных затрат.",
        userMessage: "Три вертикальных ролика с городскими видами, 9:16",
        aiReply: "**Ролик 1 из 3** · городской вид, 9:16",
      },
      {
        title: "Первое знакомство",
        text: "Понять, как формулировать запрос к видеомодели, — на недорогих попытках.",
        userMessage: "Сделай ролик: свеча горит в тёмной комнате",
        aiReply: "**Ролик** · пламя свечи в темноте",
      },
    ],
    faq: [
      {
        question: "Что такое Seedance 2.0 Fast?",
        answer:
          "Seedance 2.0 Fast — ускоренная версия Seedance 2.0: генерирует видео по тексту или из изображения быстрее и дешевле обычной. В GIPITI она доступна без VPN и с оплатой российскими картами.",
      },
      {
        question: "Что теряется по сравнению с обычной версией?",
        answer:
          "Сцены с быстрым движением и мелкими деталями обычная версия прорабатывает аккуратнее. Для черновиков, проверки идей и повседневного контента разницы почти не видно.",
      },
      mediaHistoryFaq,
      ...sharedMediaFaq,
    ],
    otherModels: buildChips([
      { name: "Seedance 2.0", tag: "Видео", slug: SEEDANCE_SLUG },
      { name: "Kling 2.5 Turbo", tag: "Видео", slug: KLING_25_TURBO_SLUG },
      { name: "Veo 3.1", tag: "Видео", slug: VEO_SLUG },
      { name: "Seedream 4.5", tag: "Изображения", slug: SEEDREAM_45_SLUG },
    ]),
  },
];
