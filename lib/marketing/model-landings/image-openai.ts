/**
 * Landing for OpenAI GPT Image 2.
 *
 * Format claims follow the registry: this model exposes three fixed sizes
 * (square, landscape, portrait) and four quality levels — not the ten aspect
 * ratios the Google models offer.
 */

import { buildChips, buildImageSteps, sharedMediaFaq } from "./media-shared";
import {
  FLUX_SLUG,
  GPT_IMAGE_SLUG,
  NANO_BANANA_SLUG,
  SEEDREAM_45_SLUG,
  SOL_SLUG,
  vpnBenefit,
} from "./shared";
import type { ModelLanding } from "./types";

export const openaiImageLandings: ModelLanding[] = [
  {
    kind: "image",
    slug: GPT_IMAGE_SLUG,
    modelId: "gpt-image-2",
    name: "GPT Image 2",
    vendor: "OpenAI",
    accent: "emerald",
    badge: "OpenAI · Фотореализм и правки · Изображения",
    h1Top: "GPT Image 2 —",
    h1Gradient: "нейросеть OpenAI для изображений",
    sub: "Модель OpenAI для генерации изображений уже в GIPITI — фотореалистичные кадры по описанию и точное редактирование готовых картинок. Без VPN, на русском, с оплатой российскими картами. Дарим 200 ₽ каждому новому пользователю.",
    ctaMain: "Попробовать GPT Image 2",
    metaTitle: "GPT Image 2 — генерация изображений от OpenAI | GIPITI",
    metaDescription:
      "GPT Image 2 в GIPITI — фотореалистичная генерация и редактирование изображений по описанию на русском. Без VPN, оплата российскими картами. Дарим 200 ₽ новым пользователям.",
    heroMedia: {
      userMessage:
        "Фото рабочего стола сверху: ноутбук, блокнот и кофе, мягкий утренний свет, альбомная ориентация",
      aiIntro: "Готово. Могу поменять свет, ракурс или добавить деталей:",
      aspect: "16:9",
      resultCaption: "Рабочий стол сверху · ноутбук, блокнот, кофе",
      resultMeta: "Качество high · альбомный формат",
    },
    benefits: [
      {
        icon: "image",
        title: "Фотореалистичные кадры",
        text: "Предметная съёмка, интерьеры и портретные сцены — модель OpenAI известна аккуратной геометрией, светом и материалами.",
      },
      {
        icon: "wand",
        title: "Точное редактирование",
        text: "Прикрепите картинку и опишите правку — заменить объект, убрать лишнее, поменять фон. Остальная сцена останется нетронутой.",
      },
      {
        icon: "ratio",
        title: "Три формата, четыре уровня качества",
        text: "Квадрат, альбомная и портретная ориентация плюс выбор качества — от быстрого черновика до финального кадра.",
      },
      vpnBenefit,
    ],
    steps: buildImageSteps("GPT Image 2"),
    audience: [
      {
        title: "Интернет-магазины",
        text: "Предметные кадры и карточки товара без студии и фотографа.",
        userMessage:
          "Покажи эти часы на мраморной поверхности с мягкой тенью 📎 watch.jpg",
        aiReply: "**Готово** · часы на мраморе, мягкая тень",
      },
      {
        title: "Маркетологи",
        text: "Рекламные визуалы и баннеры под кампанию — в одном стиле и нужной ориентации.",
        userMessage:
          "Баннер для рассылки: летняя веранда кафе, тёплые тона, альбомный формат",
        aiReply: "**Баннер** · летняя веранда, тёплые тона",
      },
      {
        title: "Дизайнеры интерьеров",
        text: "Визуализация идей до ремонта: материалы, свет и расстановка мебели.",
        userMessage:
          "Кухня 12 м² в скандинавском стиле, дневной свет, вид от двери",
        aiReply: "**Кухня 12 м²** · скандинавский стиль, дневной свет",
      },
    ],
    faq: [
      {
        question: "Что такое GPT Image 2?",
        answer:
          "GPT Image 2 — модель OpenAI для генерации и редактирования изображений. В GIPITI она доступна без VPN, с интерфейсом на русском языке и оплатой российскими картами.",
      },
      {
        question: "Какие форматы изображений доступны?",
        answer:
          "Три ориентации: квадрат, альбомная и портретная. Плюс выбор качества — от низкого для быстрых черновиков до высокого для финального кадра.",
      },
      {
        question: "Можно ли отредактировать своё фото?",
        answer:
          "Да. Прикрепите изображение в чат и опишите словами, что изменить. Модель вернёт новую версию, а исходник останется в истории диалога.",
      },
      ...sharedMediaFaq,
    ],
    otherModels: buildChips([
      { name: "Nano Banana", tag: "Изображения", slug: NANO_BANANA_SLUG },
      { name: "Flux 2 Max", tag: "Изображения", slug: FLUX_SLUG },
      { name: "Seedream 4.5", tag: "Изображения", slug: SEEDREAM_45_SLUG },
      { name: "GPT-5.6 Sol", tag: "Текст", slug: SOL_SLUG },
    ]),
  },
];
