/**
 * Landings for Recraft V4.1 Flash and Recraft v4.1 Pro.
 *
 * Flash is text-to-image only: no editing, no format picker, no styles, and
 * the copy never mentions vector output.
 *
 * Note: the model is known for clean vector-style artwork, but through the
 * gateway it returns a raster image — the copy says "векторный стиль", never
 * promises an SVG file, and the FAQ makes that explicit.
 */

import { buildChips, buildImageSteps, sharedMediaFaq } from "./media-shared";
import {
  FLUX_3_IMAGE_KLEIN_SLUG,
  FLUX_SLUG,
  GPT_IMAGE_25_FLARE_SLUG,
  GPT_IMAGE_26_FLARE_SLUG,
  MAI_IMAGE_27_FLASH_SLUG,
  NANO_BANANA_PRO_SLUG,
  RECRAFT_FLASH_SLUG,
  RECRAFT_SLUG,
  SEEDREAM_LITE_SLUG,
  vpnBenefit,
} from "./shared";
import type { ModelLanding } from "./types";

export const recraftImageLandings: ModelLanding[] = [
  {
    kind: "image",
    slug: RECRAFT_FLASH_SLUG,
    modelId: "recraft-v4.1-flash",
    name: "Recraft V4.1 Flash",
    vendor: "Recraft",
    accent: "emerald",
    badge: "Recraft · Быстро и недорого · Изображения",
    h1Top: "Recraft V4.1 Flash —",
    h1Gradient: "быстрые кадры и концепты логотипов",
    sub: "Быстрая и недорогая модель Recraft уже в GIPITI — фотографии, портреты, атмосферные сцены, коллажи и концепты логотипов по описанию на русском. Подходит для больших серий и частых проб. Без VPN, с оплатой российскими картами. Дарим 200 ₽ каждому новому пользователю.",
    ctaMain: "Попробовать Recraft V4.1 Flash",
    metaTitle: "Recraft V4.1 Flash — быстрая нейросеть для картинок | GIPITI",
    metaDescription:
      "Recraft V4.1 Flash в GIPITI — быстрая и недорогая генерация изображений: фото, портреты, атмосферные сцены, коллажи и концепты логотипов. Без VPN, оплата картами РФ.",
    heroMedia: {
      userMessage:
        "Дождливый переулок ночью: тёплые окна, лужи с отражением неоновых огней, вдали человек с жёлтым зонтом",
      aiIntro: "Готово. Могу добавить тумана или сменить время суток:",
      aspect: "16:9",
      resultCaption: "Ночной переулок под дождём · неон в лужах",
      resultMeta: "Фотореализм · атмосфера",
      sample: {
        src: "/images/model-landings/recraft-v4-1-flash/rainy-alley.webp",
        alt: "Узкий ночной переулок под дождём, в мокром асфальте отражаются огни, вдали человек с жёлтым зонтом — изображение, созданное Recraft V4.1 Flash в GIPITI",
        width: 1280,
        height: 731,
      },
    },
    benefits: [
      {
        icon: "zap",
        title: "Для частых проб и серий",
        text: "Flash создана для большого потока генераций: результат приходит быстро, а стоит недорого, поэтому можно пробовать формулировку за формулировкой.",
      },
      {
        icon: "image",
        title: "Фото, портреты и атмосфера",
        text: "Сильные стороны модели — фотографии, портреты, настроение сцены, сложные композиции и смешанные техники вроде коллажа.",
      },
      {
        icon: "palette",
        title: "Концепты логотипов",
        text: "Нужен набросок знака для первой идеи? Опишите форму и палитру — получите концепт, который можно показать клиенту или команде.",
      },
      vpnBenefit,
    ],
    steps: buildImageSteps(
      "Recraft V4.1 Flash",
      "Опишите сцену или знак: объект, свет, настроение и палитру — модель только создаёт картинки по тексту.",
      "Изображение появится прямо в чате — скачайте его или опишите новый вариант следующим сообщением."
    ),
    audience: [
      {
        title: "Авторы и редакции",
        text: "Портретные сцены и иллюстрации к историям, когда нужен образ, а не архивное фото.",
        userMessage:
          "Портрет крупным планом: пожилой рыбак с белой бородой в вязаной шапке, мягкий свет рассвета, размытое море",
        aiReply: "**Портрет** · пожилой рыбак на рассвете",
        sample: {
          src: "/images/model-landings/recraft-v4-1-flash/fisherman-portrait.webp",
          alt: "Портрет пожилого рыбака с белой бородой в тёмно-синей вязаной шапке на фоне размытого моря на рассвете",
          width: 600,
          height: 814,
        },
      },
      {
        title: "Дизайнеры и иллюстраторы",
        text: "Смешанные техники для обложек и открыток: бумага, акварель, фактуры.",
        userMessage:
          "Бумажный коллаж: горы из рваной бумаги, акварельное солнце и маленький бумажный кораблик на синей реке, без текста",
        aiReply: "**Коллаж** · рваная бумага и акварель",
        sample: {
          src: "/images/model-landings/recraft-v4-1-flash/paper-collage.webp",
          alt: "Бумажный коллаж: горы из рваной бумаги, акварельное жёлтое солнце и маленький бумажный кораблик на синей реке",
          width: 900,
          height: 585,
        },
      },
      {
        title: "Малый бизнес",
        text: "Первые наброски знака для названия или идеи — прежде чем нанимать дизайнера.",
        userMessage:
          "Концепт логотипа школы сёрфинга: стилизованная волна под круглым солнцем, два цвета, чистые формы, белый фон, без текста",
        aiReply: "**Концепт знака** · волна под солнцем",
        sample: {
          src: "/images/model-landings/recraft-v4-1-flash/surf-logo.webp",
          alt: "Концепт логотипа: оранжевая стилизованная волна на фоне чёрного круглого солнца на белом фоне",
          width: 900,
          height: 900,
        },
      },
    ],
    faq: [
      {
        question: "Что такое Recraft V4.1 Flash?",
        answer:
          "Recraft V4.1 Flash — быстрая недорогая модель Recraft для массовой генерации и частых проб: фото, портреты, атмосферные сцены, смешанные техники и концепты логотипов. В GIPITI она работает без VPN и с оплатой российскими картами.",
      },
      {
        question: "Чем Flash отличается от Recraft v4.1 Pro?",
        answer:
          "Flash — быстрая и недорогая версия, ею удобно искать идею. В Pro формат кадра выбирается заранее, а у Flash такого выбора нет: пропорции модель подбирает сама. Удачное направление можно повторить на Pro.",
      },
      {
        question: "Можно ли отредактировать готовую картинку?",
        answer:
          "Нет, Flash работает только по тексту: прикрепить изображение для правки нельзя. Для правок выберите, например, GPT Image 2.6 Sunburst или Flux 3 Image.",
      },
      {
        question: "Можно ли выбрать формат кадра или стиль?",
        answer:
          "Нет: ни формата, ни готовых стилей модель в GIPITI не предлагает. Вид картинки задаётся только описанием, поэтому пишите, что должно быть в кадре, какой свет и настроение.",
      },
      ...sharedMediaFaq,
    ],
    otherModels: buildChips([
      { name: "Recraft v4.1 Pro", tag: "Изображения", slug: RECRAFT_SLUG },
      {
        name: "Flux 3 Image Klein",
        tag: "Изображения",
        slug: FLUX_3_IMAGE_KLEIN_SLUG,
      },
      {
        name: "GPT Image 2.6 Flare",
        tag: "Изображения",
        slug: GPT_IMAGE_26_FLARE_SLUG,
      },
      {
        name: "MAI-Image 2.7 Flash",
        tag: "Изображения",
        slug: MAI_IMAGE_27_FLASH_SLUG,
      },
    ]),
  },
  {
    kind: "image",
    slug: RECRAFT_SLUG,
    modelId: "recraft-v4.1-pro",
    name: "Recraft v4.1 Pro",
    vendor: "Recraft",
    accent: "violet",
    badge: "Recraft · Логотипы и иконки · Изображения",
    h1Top: "Recraft v4.1 Pro —",
    h1Gradient: "нейросеть для логотипов и иконок",
    sub: "Модель Recraft уже в GIPITI — логотипы, иконки и брендовые иллюстрации в чистом графическом стиле по описанию на русском. Без VPN, с оплатой российскими картами. Дарим 200 ₽ каждому новому пользователю.",
    ctaMain: "Попробовать Recraft v4.1 Pro",
    metaTitle: "Recraft v4.1 Pro — нейросеть для логотипов и иконок | GIPITI",
    metaDescription:
      "Recraft v4.1 Pro в GIPITI — генерация логотипов, иконок и брендовых иллюстраций в векторном стиле по описанию на русском. Без VPN, оплата российскими картами.",
    heroMedia: {
      userMessage:
        "Логотип для доставки цветов: минималистичный тюльпан в круге, две линии, тёплый цвет",
      aiIntro: "Готово. Могу упростить форму или сменить палитру:",
      aspect: "1:1",
      resultCaption: "Логотип · тюльпан в круге, две линии",
      resultMeta: "Графический стиль · формат 1:1",
      sample: {
        src: "/images/model-landings/recraft-v4-1-pro/flower-delivery-logo.webp",
        alt: "Минималистичный логотип доставки цветов: тюльпан в круге, тонкие линии — изображение, созданное Recraft v4.1 Pro в GIPITI",
        width: 1280,
        height: 1280,
      },
    },
    benefits: [
      {
        icon: "palette",
        title: "Чистый графический стиль",
        text: "Ровные линии, плоские заливки и аккуратные формы — то, что нужно для логотипов, иконок и айдентики, а не для фотореализма.",
      },
      {
        icon: "layers",
        title: "Серии в одном стиле",
        text: "Попросите набор иконок или несколько вариантов знака — модель держит единую манеру во всей серии.",
      },
      {
        icon: "ratio",
        title: "Семь форматов кадра",
        text: "Квадрат под аватар и знак, альбомные и портретные пропорции — под площадку или макет.",
      },
      vpnBenefit,
    ],
    steps: buildImageSteps(
      "Recraft v4.1 Pro",
      "Опишите знак или иллюстрацию: объект, стиль линий, число цветов и настроение."
    ),
    audience: [
      {
        title: "Малый бизнес",
        text: "Логотип и фирменные иконки для сайта — без брифов и недель ожидания.",
        userMessage:
          "Знак для пекарни: колосок и полумесяц, две линии, один цвет",
        aiReply: "**Знак** · колосок и полумесяц, одна линия",
        sample: {
          src: "/images/model-landings/recraft-v4-1-pro/bakery-logo.webp",
          alt: "Логотип пекарни: колосок и полумесяц одной линией",
          width: 900,
          height: 900,
        },
      },
      {
        title: "Продуктовые команды",
        text: "Наборы иконок для интерфейса в единой сетке и стиле.",
        userMessage:
          "Шесть иконок для раздела настроек, тонкие линии, один стиль",
        aiReply: "**Иконка 1 из 6** · тонкие линии, единая сетка",
        sample: {
          src: "/images/model-landings/recraft-v4-1-pro/settings-icons.webp",
          alt: "Набор из шести иконок для раздела настроек: звук, яркость, уведомления, шестерёнка, цвет и клавиатура",
          width: 900,
          height: 900,
        },
      },
      {
        title: "Дизайнеры и агентства",
        text: "Быстрые концепты айдентики: десяток направлений до отрисовки в редакторе.",
        userMessage: "Три направления знака для IT-компании: сеть, куб, волна",
        aiReply: "**Направление 1** · сеть из точек и линий",
        sample: {
          src: "/images/model-landings/recraft-v4-1-pro/it-company-logo.webp",
          alt: "Три направления знака для IT-компании: сеть из точек, объёмный куб и волна",
          width: 900,
          height: 900,
        },
      },
    ],
    faq: [
      {
        question: "Что такое Recraft v4.1 Pro?",
        answer:
          "Recraft v4.1 Pro — модель для генерации графики: логотипов, иконок и иллюстраций в чистом векторном стиле. В GIPITI она доступна без VPN, с интерфейсом на русском языке и оплатой российскими картами.",
      },
      {
        question: "Приходит ли результат в SVG?",
        answer:
          "Нет. Готовая картинка приходит в чат изображением и скачивается в один клик — отдельного SVG-файла модель не возвращает. Если нужен вектор для печати, знак придётся перерисовать в графическом редакторе.",
      },
      {
        question: "Можно ли использовать логотип в бизнесе?",
        answer:
          "Технически — да, файл ваш. Но перед регистрацией товарного знака стоит проверить уникальность: модель могла сгенерировать форму, похожую на существующий знак.",
      },
      ...sharedMediaFaq,
    ],
    otherModels: buildChips([
      {
        name: "Recraft V4.1 Flash",
        tag: "Изображения",
        slug: RECRAFT_FLASH_SLUG,
      },
      { name: "Flux 2 Max", tag: "Изображения", slug: FLUX_SLUG },
      {
        name: "Nano Banana Pro",
        tag: "Изображения",
        slug: NANO_BANANA_PRO_SLUG,
      },
      {
        name: "GPT Image 2.5 Flare",
        tag: "Изображения",
        slug: GPT_IMAGE_25_FLARE_SLUG,
      },
      {
        name: "Seedream 5.0 Lite",
        tag: "Изображения",
        slug: SEEDREAM_LITE_SLUG,
      },
    ]),
  },
];
