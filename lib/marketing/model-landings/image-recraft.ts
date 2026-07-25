/**
 * Landing for Recraft v4.1 Pro.
 *
 * Note: the model is known for clean vector-style artwork, but through the
 * gateway it returns a raster image — the copy says "векторный стиль", never
 * promises an SVG file, and the FAQ makes that explicit.
 */

import { buildChips, buildImageSteps, sharedMediaFaq } from "./media-shared";
import {
  FLUX_SLUG,
  GPT_IMAGE_SLUG,
  NANO_BANANA_PRO_SLUG,
  RECRAFT_SLUG,
  SEEDREAM_LITE_SLUG,
  vpnBenefit,
} from "./shared";
import type { ModelLanding } from "./types";

export const recraftImageLandings: ModelLanding[] = [
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
      },
      {
        title: "Продуктовые команды",
        text: "Наборы иконок для интерфейса в единой сетке и стиле.",
        userMessage:
          "Шесть иконок для раздела настроек, тонкие линии, один стиль",
        aiReply: "**Иконка 1 из 6** · тонкие линии, единая сетка",
      },
      {
        title: "Дизайнеры и агентства",
        text: "Быстрые концепты айдентики: десяток направлений до отрисовки в редакторе.",
        userMessage: "Три направления знака для IT-компании: сеть, куб, волна",
        aiReply: "**Направление 1** · сеть из точек и линий",
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
      { name: "Flux 2 Max", tag: "Изображения", slug: FLUX_SLUG },
      {
        name: "Nano Banana Pro",
        tag: "Изображения",
        slug: NANO_BANANA_PRO_SLUG,
      },
      { name: "GPT Image 2", tag: "Изображения", slug: GPT_IMAGE_SLUG },
      {
        name: "Seedream 5.0 Lite",
        tag: "Изображения",
        slug: SEEDREAM_LITE_SLUG,
      },
    ]),
  },
];
