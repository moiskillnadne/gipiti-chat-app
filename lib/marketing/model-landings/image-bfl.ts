/**
 * Landing for Black Forest Labs Flux 2 Max.
 *
 * Note: the model takes no generation settings — its API accepts only
 * width/height and the gateway silently ignores aspect ratio, so the copy
 * never promises format control and the FAQ says so outright.
 */

import {
  buildChips,
  buildImageSteps,
  chatIterationBenefit,
  sharedMediaFaq,
} from "./media-shared";
import {
  FLUX_SLUG,
  GPT_IMAGE_SLUG,
  NANO_BANANA_PRO_SLUG,
  RECRAFT_SLUG,
  SEEDREAM_45_SLUG,
  vpnBenefit,
} from "./shared";
import type { ModelLanding } from "./types";

export const bflImageLandings: ModelLanding[] = [
  {
    kind: "image",
    slug: FLUX_SLUG,
    modelId: "flux-2-max",
    name: "Flux 2 Max",
    vendor: "Black Forest Labs",
    accent: "rose",
    badge: "Black Forest Labs · Художественные стили · Изображения",
    h1Top: "Flux 2 Max —",
    h1Gradient: "нейросеть для художественных картинок",
    sub: "Старшая модель Black Forest Labs уже в GIPITI — насыщенные художественные стили и высокая детализация по описанию на русском. Без VPN, с оплатой российскими картами. Дарим 200 ₽ каждому новому пользователю.",
    ctaMain: "Попробовать Flux 2 Max",
    metaTitle: "Flux 2 Max — нейросеть для генерации изображений | GIPITI",
    metaDescription:
      "Flux 2 Max в GIPITI — художественная генерация изображений от Black Forest Labs: стили, детализация и атмосфера. Без VPN, на русском, оплата российскими картами.",
    heroMedia: {
      userMessage:
        "Старый маяк в шторм, масляная живопись, густые мазки, драматичный свет",
      aiIntro: "Готово. Могу усилить стиль или сменить время суток:",
      aspect: "1:1",
      resultCaption: "Маяк в шторм · масляная живопись, густые мазки",
      resultMeta: "Художественный стиль · высокая детализация",
      sample: {
        src: "/images/model-landings/flux-2-max/lighthouse.webp",
        alt: "Старый маяк в шторм, написанный маслом густыми мазками — изображение, созданное Flux 2 Max в GIPITI",
        width: 1024,
        height: 1024,
      },
    },
    benefits: [
      {
        icon: "palette",
        title: "Сильные художественные стили",
        text: "Масло, акварель, гравюра, ретро-постер, киноплёнка — Flux уверенно держит стиль целиком, а не только его отдельные признаки.",
      },
      {
        icon: "sparkles",
        title: "Высокая детализация",
        text: "Фактуры, свет и мелкие детали проработаны так, что картинку не стыдно поставить на обложку или напечатать.",
      },
      chatIterationBenefit,
      vpnBenefit,
    ],
    steps: buildImageSteps(
      "Flux 2 Max",
      "Опишите сцену и обязательно стиль: «масляная живопись», «ретро-постер», «плёночное фото»."
    ),
    audience: [
      {
        title: "Иллюстраторы и художники",
        text: "Референсы, концепты и наброски в выбранной технике — быстрее, чем искать на стоках.",
        userMessage: "Концепт персонажа: странник в плаще, тушь и акварель",
        aiReply: "**Концепт** · странник в плаще, тушь и акварель",
        sample: {
          src: "/images/model-landings/flux-2-max/wanderer.webp",
          alt: "Концепт персонажа: странник в плаще с посохом, тушь и акварель",
          width: 900,
          height: 900,
        },
      },
      {
        title: "Издатели и авторы",
        text: "Обложки книг и иллюстрации к главам — в единой художественной манере.",
        userMessage: "Обложка для детектива: ночной город, дождь, стиль нуар",
        aiReply: "**Обложка** · ночной город под дождём, нуар",
        sample: {
          src: "/images/model-landings/flux-2-max/book-cover.webp",
          alt: "Обложка детектива в стиле нуар: фигура в плаще на ночной улице под дождём",
          width: 900,
          height: 900,
        },
      },
      {
        title: "Бренды и агентства",
        text: "Атмосферные визуалы для кампаний, когда нужен характер, а не сток.",
        userMessage:
          "Постер для кофейни в стиле винтажного плаката 1950-х, тёплая гамма",
        aiReply: "**Постер** · винтаж 1950-х, тёплая гамма",
        sample: {
          src: "/images/model-landings/flux-2-max/coffee-1950s.webp",
          alt: "Постер кофейни в стиле винтажного плаката 1950-х годов в тёплой гамме",
          width: 669,
          height: 900,
        },
      },
    ],
    faq: [
      {
        question: "Что такое Flux 2 Max?",
        answer:
          "Flux 2 Max — старшая модель для генерации изображений от Black Forest Labs: художественные стили, высокая детализация и выразительная композиция. В GIPITI она доступна без VPN и с оплатой российскими картами.",
      },
      {
        question: "Можно ли выбрать формат изображения?",
        answer:
          "У Flux 2 Max нет настроек формата — модель сама подбирает пропорции под запрос. Если нужен конкретный формат кадра, выберите Nano Banana, GPT Image 2 или Seedream: там соотношение сторон настраивается.",
      },
      {
        question: "Чем Flux отличается от Nano Banana и GPT Image?",
        answer:
          "Flux сильнее в художественных стилях и атмосфере, а Nano Banana и GPT Image — в точном следовании описанию и редактировании готовых фото. Все три модели входят в одну подписку — сравните на своей задаче.",
      },
      ...sharedMediaFaq,
    ],
    otherModels: buildChips([
      {
        name: "Nano Banana Pro",
        tag: "Изображения",
        slug: NANO_BANANA_PRO_SLUG,
      },
      { name: "GPT Image 2", tag: "Изображения", slug: GPT_IMAGE_SLUG },
      { name: "Recraft v4.1 Pro", tag: "Изображения", slug: RECRAFT_SLUG },
      { name: "Seedream 4.5", tag: "Изображения", slug: SEEDREAM_45_SLUG },
    ]),
  },
];
