/**
 * Landings for the Black Forest Labs image models — Flux 3 Image and Flux 2 Max.
 *
 * Note: neither model takes generation settings — their API accepts only
 * width/height and the gateway silently ignores aspect ratio, so the copy
 * never promises format control and the FAQ says so outright. Flux 3 Image
 * does follow shape words in the prompt (a "wide 16:9" prompt came back
 * 1360 × 768, square prompts 1024 × 1024), which is what its FAQ describes.
 * Its "green sofa" tile is a real edit of the hero render.
 */

import {
  buildChips,
  buildImageSteps,
  chatIterationBenefit,
  sharedMediaFaq,
} from "./media-shared";
import {
  FLUX_3_IMAGE_SLUG,
  FLUX_SLUG,
  FLUX_VIDEO_SLUG,
  GPT_IMAGE_25_SUNBURST_SLUG,
  NANO_BANANA_PRO_SLUG,
  RECRAFT_SLUG,
  vpnBenefit,
} from "./shared";
import type { ModelLanding } from "./types";

export const bflImageLandings: ModelLanding[] = [
  {
    kind: "image",
    slug: FLUX_3_IMAGE_SLUG,
    modelId: "flux-3-image",
    name: "Flux 3 Image",
    vendor: "Black Forest Labs",
    accent: "violet",
    badge: "Black Forest Labs · Новый флагман · Изображения",
    h1Top: "Flux 3 Image —",
    h1Gradient: "генерация и правки в одной модели",
    sub: "Новый флагман Black Forest Labs уже в GIPITI — рисует по описанию на русском и правит готовые изображения той же моделью, без ручных масок. Без VPN, с оплатой российскими картами. Дарим 200 ₽ каждому новому пользователю.",
    ctaMain: "Попробовать Flux 3 Image",
    metaTitle: "Flux 3 Image — нейросеть для картинок от BFL | GIPITI",
    metaDescription:
      "Flux 3 Image в GIPITI — флагман Black Forest Labs: генерация изображений и точечные правки в одной модели, промпт на русском. Без VPN, оплата картами РФ.",
    heroMedia: {
      userMessage:
        "Скандинавская гостиная: серый диван, большое окно, растения в кадках, утренний свет",
      aiIntro: "Готово. Могу поменять любую деталь, **не трогая остальное**:",
      aspect: "1:1",
      resultCaption: "Скандинавская гостиная · утренний свет",
      resultMeta: "Фотореализм · интерьер",
      sample: {
        src: "/images/model-landings/flux-3-image/living-room.webp",
        alt: "Светлая скандинавская гостиная с серым диваном, большим окном и растениями — изображение, созданное Flux 3 Image в GIPITI",
        width: 1024,
        height: 1024,
      },
    },
    benefits: [
      {
        icon: "layers",
        title: "Рисует и редактирует",
        text: "Создайте картинку с нуля или прикрепите свою и попросите правку — Flux 3 Image делает и то и другое, переключаться между моделями не нужно.",
      },
      {
        icon: "wand",
        title: "Точечные правки без масок",
        text: "Поменяйте цвет дивана или уберите лишний предмет словами — выделять область вручную не нужно, остальная часть кадра остаётся как была.",
      },
      {
        icon: "sparkles",
        title: "Флагман нового поколения",
        text: "Главная модель Black Forest Labs, вышедшая в октябре 2026 года, — следующая ступень после Flux 2 Max.",
      },
      vpnBenefit,
    ],
    steps: buildImageSteps(
      "Flux 3 Image",
      "Опишите сцену — или прикрепите изображение и скажите, что в нём изменить."
    ),
    audience: [
      {
        title: "Дизайнеры интерьеров",
        text: "Показать клиенту варианты отделки и мебели на одном и том же кадре комнаты.",
        userMessage:
          "Покажи эту комнату с зелёным бархатным диваном вместо серого 📎 room.jpg",
        aiReply: "**Правка** · диван стал зелёным, комната та же",
        sample: {
          src: "/images/model-landings/flux-3-image/green-sofa.webp",
          alt: "Скандинавская гостиная с зелёным бархатным диваном у большого окна",
          width: 900,
          height: 900,
        },
      },
      {
        title: "Предметная съёмка",
        text: "Кадры для каталога и рекламы без студии, света и реквизита.",
        userMessage:
          "Флакон духов на мокром чёрном камне, капли воды, контровой свет",
        aiReply: "**Предметный кадр** · флакон на мокром камне",
        sample: {
          src: "/images/model-landings/flux-3-image/perfume-stone.webp",
          alt: "Стеклянный флакон духов на мокром чёрном камне с каплями воды в контровом свете",
          width: 900,
          height: 900,
        },
      },
      {
        title: "Иллюстраторы и издатели",
        text: "Иллюстрации к книгам и статьям в заданной технике — и правки по ним в том же чате.",
        userMessage:
          "Иллюстрация к сказке: лиса с фонарём идёт по зимнему лесу, гуашь",
        aiReply: "**Иллюстрация** · лиса с фонарём, гуашь",
        sample: {
          src: "/images/model-landings/flux-3-image/fox-lantern.webp",
          alt: "Гуашевая иллюстрация: лиса с фонарём идёт по ночному зимнему лесу",
          width: 900,
          height: 900,
        },
      },
    ],
    faq: [
      {
        question: "Что такое Flux 3 Image?",
        answer:
          "Flux 3 Image — флагманская модель Black Forest Labs для генерации и редактирования изображений, вышедшая в октябре 2026 года. В GIPITI она доступна без VPN, с промптом на русском и оплатой российскими картами.",
      },
      {
        question: "Чем Flux 3 Image отличается от Flux 2 Max?",
        answer:
          "Flux 3 Image — новое поколение: одна модель и рисует, и редактирует, причём правит отдельные участки без ручных масок. Flux 2 Max остаётся сильным выбором для художественных стилей. Обе модели есть в GIPITI.",
      },
      {
        question: "Можно ли выбрать формат изображения?",
        answer:
          "В GIPITI у Flux 3 Image нет настроек формата — модель сама подбирает пропорции под запрос. Если нужен точный формат кадра, выберите Nano Banana или Seedream: там соотношение сторон задаётся перед генерацией.",
      },
      ...sharedMediaFaq,
    ],
    otherModels: buildChips([
      { name: "Flux 2 Max", tag: "Изображения", slug: FLUX_SLUG },
      { name: "Flux 3 Video", tag: "Видео", slug: FLUX_VIDEO_SLUG },
      {
        name: "Nano Banana Pro",
        tag: "Изображения",
        slug: NANO_BANANA_PRO_SLUG,
      },
      { name: "Recraft v4.1 Pro", tag: "Изображения", slug: RECRAFT_SLUG },
    ]),
  },
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
      { name: "Flux 3 Image", tag: "Изображения", slug: FLUX_3_IMAGE_SLUG },
      {
        name: "Nano Banana Pro",
        tag: "Изображения",
        slug: NANO_BANANA_PRO_SLUG,
      },
      {
        name: "GPT Image 2.5 Sunburst",
        tag: "Изображения",
        slug: GPT_IMAGE_25_SUNBURST_SLUG,
      },
      { name: "Flux 3 Video", tag: "Видео", slug: FLUX_VIDEO_SLUG },
    ]),
  },
];
