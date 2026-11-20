/**
 * Landings for the ByteDance video models: Seedance 2.5 Flash, 2.5, 2.0 and
 * 2.0 Fast. Seedance 2.5 Flash renders 720p clips with sound, 5 or 10 s, from
 * text or one image — no 1080p, no 30 s, no reference or editing modes.
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
  GROK_IMAGINE_VIDEO_LITE_SLUG,
  KLING_25_TURBO_SLUG,
  KLING_30_SLUG,
  SEEDANCE_25_FLASH_SLUG,
  SEEDANCE_25_SLUG,
  SEEDANCE_FAST_SLUG,
  SEEDANCE_SLUG,
  SEEDREAM_45_SLUG,
  SEEDREAM_55_SLUG,
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
    slug: SEEDANCE_25_FLASH_SLUG,
    modelId: "seedance-2.5-flash",
    name: "Seedance 2.5 Flash",
    vendor: "ByteDance",
    accent: "sky",
    badge: "ByteDance · Дешевле Seedance 2.5 · Видео",
    h1Top: "Seedance 2.5 Flash —",
    h1Gradient: "видео со звуком дешевле Seedance 2.5",
    sub: "Облегчённая версия Seedance 2.5 уже в GIPITI — ролики 720p со звуком по описанию или из вашей картинки, на 5 или 10 секунд. Дешевле старшей модели, поэтому удобно пробовать сцены. Без VPN, с оплатой российскими картами. Дарим 200 ₽ каждому новому пользователю.",
    ctaMain: "Попробовать Seedance 2.5 Flash",
    metaTitle: "Seedance 2.5 Flash — видео со звуком от ByteDance | GIPITI",
    metaDescription:
      "Seedance 2.5 Flash в GIPITI — более доступная версия Seedance 2.5: ролики 720p со звуком на 5 или 10 секунд по тексту или картинке. Без VPN, оплата картами РФ.",
    heroMedia: {
      userMessage:
        "Ролик: рыбацкая лодка выходит из тумана на спокойное озеро, плеск воды, рассветный свет, 16:9",
      aiIntro: "Готово — **плеск воды** и рассветный свет уже в ролике:",
      aspect: "16:9",
      resultCaption: "Лодка выходит из тумана · рассвет, плеск воды",
      resultMeta: "5 секунд · 720p · 16:9 · со звуком",
    },
    benefits: [
      {
        icon: "wallet",
        title: "Дешевле Seedance 2.5",
        text: "Flash — облегчённый вариант новой видеомодели ByteDance: по прайсу он стоит меньше, поэтому сцену можно сначала прогнать на нём.",
      },
      {
        icon: "volume",
        title: "Звук сразу в ролике",
        text: "Модель создаёт звуковую дорожку вместе с картинкой: звуки сцены и атмосферу — озвучивать ролик отдельно не нужно.",
      },
      {
        icon: "ratio",
        title: "Шесть форматов, 5 или 10 секунд",
        text: "От вертикального 9:16 до широкого 21:9; длительность и формат выбираете перед запуском. Качество — 720p.",
      },
      vpnBenefit,
    ],
    steps: buildVideoSteps(
      "Seedance 2.5 Flash",
      "Опишите, что происходит в кадре и что слышно, — или прикрепите одну картинку, которую нужно оживить."
    ),
    audience: [
      {
        title: "Реклама и товары",
        text: "Короткие предметные ролики для карточки или рекламы: движение камеры и звук без съёмки.",
        userMessage:
          "Чашка чая на подоконнике, поднимается пар, за окном моросит дождь, камера медленно приближается",
        aiReply: "**Ролик** · пар над чашкой, дождь за окном",
      },
      {
        title: "Соцсети и Reels",
        text: "Вертикальные клипы под ленту — проверьте идею за пару запросов.",
        userMessage:
          "Кондитер посыпает пудрой свежий круассан, замедленная съёмка, вертикальный кадр 9:16",
        aiReply: "**Вертикальный ролик** · пудра на круассане, 9:16",
      },
      {
        title: "Оживление иллюстраций",
        text: "Превратите одну картинку в короткую сцену: движение, атмосфера и звук.",
        userMessage:
          "Оживи эту иллюстрацию: лисёнок крадётся по осеннему лесу, шуршат листья 📎 fox.png",
        aiReply: "**Кадр ожил** · лисёнок в осеннем лесу",
      },
    ],
    faq: [
      {
        question: "Что такое Seedance 2.5 Flash?",
        answer:
          "Seedance 2.5 Flash — более доступный по цене вариант видеомодели Seedance 2.5 от ByteDance: создаёт ролики со звуком по тексту или из одной картинки. В GIPITI она работает без VPN и с оплатой российскими картами.",
      },
      {
        question: "Чем Flash отличается от Seedance 2.5?",
        answer:
          "Flash дешевле, и это главное отличие. Сцену удобно сначала проверить на ней, а понравившуюся идею повторить на Seedance 2.5 и сравнить результат. Обе модели есть в GIPITI.",
      },
      {
        question: "Какой длины ролики и в каком качестве?",
        answer:
          "Ролик длится 5 или 10 секунд, качество — 720p, звук включён. Формат кадра — один из шести, от 9:16 до 21:9. Генерация занимает порядка минуты-двух, готовый ролик появится в чате.",
      },
      {
        question: "Можно ли оживить свою картинку?",
        answer:
          "Да, прикрепите одно изображение и опишите, что должно происходить. Без вложения модель сделает ролик по одному тексту.",
      },
      ...sharedMediaFaq,
    ],
    otherModels: buildChips([
      { name: "Seedance 2.5", tag: "Видео", slug: SEEDANCE_25_SLUG },
      {
        name: "Grok Imagine Video Lite",
        tag: "Видео",
        slug: GROK_IMAGINE_VIDEO_LITE_SLUG,
      },
      { name: "Veo 3.1", tag: "Видео", slug: VEO_SLUG },
      { name: "Seedream 5.5", tag: "Изображения", slug: SEEDREAM_55_SLUG },
    ]),
  },
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
      {
        name: "Seedance 2.5 Flash",
        tag: "Видео",
        slug: SEEDANCE_25_FLASH_SLUG,
      },
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
