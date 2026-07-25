/** Landing for xAI Grok Imagine (images). */

import {
  buildChips,
  buildImageSteps,
  chatIterationBenefit,
  sharedMediaFaq,
} from "./media-shared";
import {
  GROK_IMAGINE_SLUG,
  GROK_IMAGINE_VIDEO_SLUG,
  GROK_SLUG,
  NANO_BANANA_LITE_SLUG,
  NANO_BANANA_SLUG,
  vpnBenefit,
} from "./shared";
import type { ModelLanding } from "./types";

export const xaiImageLandings: ModelLanding[] = [
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
      },
      {
        title: "Авторы каналов",
        text: "Обложки постов и превью в нужном формате — без стоков и подписок на фотобанки.",
        userMessage: "Обложка выпуска про космос: спутник над Землёй, 16:9",
        aiReply: "**Обложка 16:9** · спутник над Землёй",
      },
      {
        title: "Все, кто хочет попробовать",
        text: "Первое знакомство с генерацией картинок — быстро и без сложных настроек.",
        userMessage: "Нарисуй открытку ко дню рождения с воздушными шарами",
        aiReply: "**Открытка** · воздушные шары, пастельные тона",
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
