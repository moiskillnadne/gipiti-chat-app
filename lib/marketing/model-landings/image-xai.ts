/** Landings for the xAI Grok Imagine image models: 2.0 and the original. */

import {
  buildChips,
  buildImageSteps,
  chatIterationBenefit,
  sharedMediaFaq,
} from "./media-shared";
import {
  GROK_46_SLUG,
  GROK_IMAGINE_20_SLUG,
  GROK_IMAGINE_SLUG,
  GROK_IMAGINE_VIDEO_SLUG,
  GROK_SLUG,
  NANO_BANANA_LITE_SLUG,
  NANO_BANANA_SLUG,
  SEEDREAM_PRO_SLUG,
  vpnBenefit,
} from "./shared";
import type { ModelLanding } from "./types";

export const xaiImageLandings: ModelLanding[] = [
  {
    kind: "image",
    slug: GROK_IMAGINE_20_SLUG,
    modelId: "grok-imagine-image-2.0",
    name: "Grok Imagine 2.0",
    vendor: "xAI",
    accent: "violet",
    badge: "xAI · Новое поколение · Изображения",
    h1Top: "Grok Imagine 2.0 —",
    h1Gradient: "новое поколение картинок от xAI",
    sub: "Новая версия генератора изображений xAI уже в GIPITI — выше детализация, точнее следование описанию и семь форматов кадра. Без VPN, на русском, с оплатой российскими картами. Дарим 200 ₽ каждому новому пользователю.",
    ctaMain: "Попробовать Grok Imagine 2.0",
    metaTitle: "Grok Imagine 2.0 — генерация изображений от xAI | GIPITI",
    metaDescription:
      "Grok Imagine 2.0 в GIPITI — новое поколение генератора изображений xAI: выше детализация, точнее следование промпту, семь форматов кадра. Без VPN, оплата российскими картами.",
    heroMedia: {
      userMessage:
        "Маяк на скале в шторм на закате, луч света сквозь дождь, огромные волны, 16:9",
      aiIntro: "Готово. Скажите, что изменить — сделаю ещё вариант:",
      aspect: "16:9",
      resultCaption: "Маяк в шторм · луч света сквозь дождь",
      resultMeta: "Формат 16:9",
      sample: {
        src: "/images/model-landings/grok-imagine-2-0/lighthouse.webp",
        alt: "Маяк на скалистом обрыве в шторм на закате, луч света пробивается сквозь дождь, волны разбиваются о камни — изображение, созданное Grok Imagine 2.0 в GIPITI",
        width: 1280,
        height: 720,
      },
    },
    benefits: [
      {
        icon: "sparkles",
        title: "Заметно выше детализация",
        text: "Второе поколение Grok Imagine аккуратнее прорабатывает свет, фактуру и мелкие детали — картинка выдерживает просмотр в полный размер, а не только превью.",
      },
      {
        icon: "wand",
        title: "Точнее следует описанию",
        text: "Модель лучше удерживает всё, что вы перечислили: время суток, ракурс, погоду и настроение — реже приходится переспрашивать.",
      },
      {
        icon: "ratio",
        title: "Семь форматов кадра",
        text: "16:9 для обложки, 9:16 для сторис, квадрат для аватара и ещё четыре пропорции — выбирайте прямо в чате.",
      },
      vpnBenefit,
    ],
    steps: buildImageSteps("Grok Imagine 2.0"),
    audience: [
      {
        title: "Репортаж и атмосфера",
        text: "Живые сцены со сложным светом — там, где важны фактура и настроение кадра.",
        userMessage:
          "Ночной рынок уличной еды, пар над воком, неон отражается в мокром асфальте",
        aiReply: "**Готово** · ночной рынок, пар над воком, неон",
        sample: {
          src: "/images/model-landings/grok-imagine-2-0/street-food.webp",
          alt: "Ночной рынок уличной еды: повар готовит в воке, пар, неоновые вывески отражаются в мокром асфальте",
          width: 900,
          height: 506,
        },
      },
      {
        title: "Travel и спорт",
        text: "Пейзажи и активные сцены для обложек, презентаций и постов.",
        userMessage:
          "Альпинист выходит на гребень на рассвете, море облаков внизу",
        aiReply: "**Кадр** · гребень на рассвете, море облаков",
        sample: {
          src: "/images/model-landings/grok-imagine-2-0/climber.webp",
          alt: "Альпинист поднимается на горный гребень на рассвете, внизу море облаков и вершины",
          width: 900,
          height: 506,
        },
      },
      {
        title: "Иллюстраторы и авторы",
        text: "Не только фотореализм: книжные иллюстрации и рисованные стили тоже.",
        userMessage:
          "Детская иллюстрация: лисёнок в шарфе читает книгу при свече в дупле",
        aiReply: "**Иллюстрация** · лисёнок читает при свече",
        sample: {
          src: "/images/model-landings/grok-imagine-2-0/reading-fox.webp",
          alt: "Книжная иллюстрация: лисёнок в вязаном шарфе читает книгу при свече внутри дупла",
          width: 900,
          height: 506,
        },
      },
    ],
    faq: [
      {
        question: "Что такое Grok Imagine 2.0?",
        answer:
          "Grok Imagine 2.0 — новое поколение модели xAI для генерации изображений. По сравнению с первой версией она детальнее прорабатывает кадр и точнее следует описанию. В GIPITI доступна без VPN, на русском и с оплатой российскими картами.",
      },
      {
        question: "Чем 2.0 отличается от первой версии Grok Imagine?",
        answer:
          "Главное отличие — качество кадра: выше детализация и точнее следование промпту. Первая версия остаётся дешевле и быстрее, поэтому обе доступны в GIPITI — выбирайте по задаче.",
      },
      {
        question: "Умеет ли Grok Imagine делать видео?",
        answer:
          "Да, но это отдельная модель — Grok Imagine Video. Она создаёт короткие ролики по описанию или из готовой картинки и доступна в той же подписке.",
      },
      ...sharedMediaFaq,
    ],
    otherModels: buildChips([
      { name: "Grok Imagine", tag: "Изображения", slug: GROK_IMAGINE_SLUG },
      {
        name: "Seedream 5.0 Pro",
        tag: "Изображения",
        slug: SEEDREAM_PRO_SLUG,
      },
      {
        name: "Grok Imagine Video",
        tag: "Видео",
        slug: GROK_IMAGINE_VIDEO_SLUG,
      },
      { name: "Grok 4.6", tag: "Текст", slug: GROK_46_SLUG },
    ]),
  },
  {
    kind: "image",
    slug: GROK_IMAGINE_SLUG,
    modelId: "grok-imagine-image",
    name: "Grok Imagine",
    vendor: "xAI",
    accent: "teal",
    badge: "xAI · Быстрые генерации · Изображения",
    h1Top: "Grok Imagine —",
    h1Gradient: "быстрая генерация картинок от xAI",
    sub: "Модель xAI для изображений уже в GIPITI — быстрые генерации по описанию и семь форматов кадра. Без VPN, на русском, с оплатой российскими картами. Дарим 200 ₽ каждому новому пользователю.",
    ctaMain: "Попробовать Grok Imagine",
    metaTitle: "Grok Imagine — генерация изображений от xAI | GIPITI",
    metaDescription:
      "Grok Imagine в GIPITI — быстрая генерация изображений от xAI по описанию на русском, семь форматов кадра. Без VPN, оплата российскими картами.",
    heroMedia: {
      userMessage:
        "Скейтбордист в прыжке на городской крыше на фоне заката, длинные тени, 16:9",
      aiIntro: "Готово. Скажите, что изменить — сделаю ещё вариант:",
      aspect: "16:9",
      resultCaption: "Скейтбордист на крыше · закат, длинные тени",
      resultMeta: "Формат 16:9",
      sample: {
        src: "/images/model-landings/grok-imagine/skateboard.webp",
        alt: "Скейтбордист в прыжке на городской крыше на фоне заката — изображение, созданное Grok Imagine в GIPITI",
        width: 1280,
        height: 720,
      },
    },
    benefits: [
      {
        icon: "zap",
        title: "Быстрые генерации",
        text: "Grok Imagine создавалась под скорость: картинка появляется в чате почти сразу, поэтому идеи удобно перебирать десятками.",
      },
      {
        icon: "ratio",
        title: "Семь форматов кадра",
        text: "16:9 для обложки, 9:16 для сторис, квадрат для аватара и ещё четыре пропорции — выбирайте прямо в чате.",
      },
      chatIterationBenefit,
      vpnBenefit,
    ],
    steps: buildImageSteps("Grok Imagine"),
    audience: [
      {
        title: "Соцсети и мемы",
        text: "Быстрые картинки к постам, когда идея нужна прямо сейчас.",
        userMessage: "Кот-программист в наушниках за тремя мониторами, ночь",
        aiReply: "**Готово** · кот за тремя мониторами, ночная подсветка",
        sample: {
          src: "/images/model-landings/grok-imagine/cat-programmer.webp",
          alt: "Кот в наушниках за тремя мониторами с кодом в ночной комнате",
          width: 900,
          height: 506,
        },
      },
      {
        title: "Авторы каналов",
        text: "Обложки постов и превью в нужном формате — без стоков и подписок на фотобанки.",
        userMessage: "Обложка выпуска про космос: спутник над Землёй, 16:9",
        aiReply: "**Обложка 16:9** · спутник над Землёй",
        sample: {
          src: "/images/model-landings/grok-imagine/sputnik.webp",
          alt: "Обложка выпуска про космос: спутник над Землёй и заголовок «Космический вестник»",
          width: 900,
          height: 506,
        },
      },
      {
        title: "Все, кто хочет попробовать",
        text: "Первое знакомство с генерацией картинок — быстро и без сложных настроек.",
        userMessage: "Нарисуй открытку ко дню рождения с воздушными шарами",
        aiReply: "**Открытка** · воздушные шары, пастельные тона",
        sample: {
          src: "/images/model-landings/grok-imagine/birthday-card.webp",
          alt: "Открытка ко дню рождения с воздушными шарами в пастельных тонах",
          width: 900,
          height: 506,
        },
      },
    ],
    faq: [
      {
        question: "Что такое Grok Imagine?",
        answer:
          "Grok Imagine — модель xAI для генерации изображений. В GIPITI она доступна без VPN, с интерфейсом на русском языке и оплатой российскими картами.",
      },
      {
        question: "Умеет ли Grok Imagine делать видео?",
        answer:
          "Да, но это отдельная модель — Grok Imagine Video. Она создаёт короткие ролики по описанию или из готовой картинки и доступна в той же подписке.",
      },
      {
        question: "Когда лучше выбрать другую модель?",
        answer:
          "Если нужно отредактировать своё фото или получить надпись на картинке, возьмите Nano Banana или Nano Banana Pro. Grok Imagine сильна там, где важна скорость.",
      },
      ...sharedMediaFaq,
    ],
    otherModels: buildChips([
      {
        name: "Grok Imagine Video",
        tag: "Видео",
        slug: GROK_IMAGINE_VIDEO_SLUG,
      },
      { name: "Nano Banana", tag: "Изображения", slug: NANO_BANANA_SLUG },
      {
        name: "Nano Banana Lite",
        tag: "Изображения",
        slug: NANO_BANANA_LITE_SLUG,
      },
      { name: "Grok 4.5", tag: "Текст", slug: GROK_SLUG },
    ]),
  },
];
