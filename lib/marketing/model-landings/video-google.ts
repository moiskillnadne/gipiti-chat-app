/**
 * Landing for Google Veo 3.1.
 *
 * Duration and resolution claims follow the registry: 4/6/8-second clips in
 * 16:9 or 9:16, 720p or 1080p (1080p forces the 8-second length).
 */

import { buildChips, buildVideoSteps, sharedMediaFaq } from "./media-shared";
import {
  GROK_IMAGINE_VIDEO_SLUG,
  KLING_30_SLUG,
  NANO_BANANA_SLUG,
  SEEDANCE_SLUG,
  VEO_SLUG,
  vpnBenefit,
} from "./shared";
import type { ModelLanding } from "./types";

export const googleVideoLandings: ModelLanding[] = [
  {
    kind: "video",
    slug: VEO_SLUG,
    modelId: "veo-3.1",
    name: "Veo 3.1",
    vendor: "Google",
    accent: "teal",
    badge: "Google · Видео со звуком · Видео",
    h1Top: "Veo 3.1 —",
    h1Gradient: "нейросеть для видео со звуком",
    sub: "Флагманская видеомодель Google уже в GIPITI — кинематографичные ролики со звуком по описанию на русском или из вашей картинки. Без VPN, с оплатой российскими картами. Дарим 200 ₽ каждому новому пользователю.",
    ctaMain: "Попробовать Veo 3.1",
    metaTitle: "Veo 3.1 — нейросеть для генерации видео со звуком | GIPITI",
    metaDescription:
      "Veo 3.1 в GIPITI — генерация видео со звуком по текстовому описанию или из изображения, до 8 секунд в 1080p. Без VPN, на русском, оплата российскими картами.",
    heroMedia: {
      userMessage:
        "Сделай ролик: волны накатывают на галечный пляж на рассвете, шум прибоя, 16:9",
      aiIntro: "Ролик готов — **со звуком прибоя**:",
      aspect: "16:9",
      resultCaption: "Волны на галечном пляже · рассвет, шум прибоя",
      resultMeta: "8 секунд · 1080p · 16:9 · со звуком",
    },
    benefits: [
      {
        icon: "volume",
        title: "Видео сразу со звуком",
        text: "Veo генерирует звуковую дорожку вместе с картинкой: шум среды, эффекты и речь — отдельно озвучивать ролик не нужно.",
      },
      {
        icon: "video",
        title: "Кинематографичное качество",
        text: "Плавное движение камеры, естественный свет и правдоподобная физика — ролики выглядят снятыми, а не собранными из кадров.",
      },
      {
        icon: "image",
        title: "Оживляет вашу картинку",
        text: "Прикрепите изображение и опишите движение — Veo сделает из статичного кадра короткий ролик.",
      },
      vpnBenefit,
    ],
    steps: buildVideoSteps("Veo 3.1"),
    audience: [
      {
        title: "Маркетологи",
        text: "Короткие рекламные ролики для соцсетей — без съёмки и монтажа.",
        userMessage:
          "Ролик для сторис: чашка кофе на столе, пар, утренний свет, 9:16",
        aiReply: "**Ролик 9:16** · чашка кофе, пар, утренний свет",
      },
      {
        title: "SMM и авторы каналов",
        text: "Заставки, переходы и фоновые видео под посты — в нужной ориентации.",
        userMessage:
          "Заставка для канала: неоновая надпись загорается в темноте",
        aiReply: "**Заставка** · неоновая надпись загорается в темноте",
      },
      {
        title: "Продуктовые команды",
        text: "Быстрые концепты видео до того, как заказывать продакшн.",
        userMessage:
          "Покажи, как приложение открывается на телефоне в руке, крупный план",
        aiReply: "**Концепт** · телефон в руке, крупный план",
      },
    ],
    faq: [
      {
        question: "Что такое Veo 3.1?",
        answer:
          "Veo 3.1 — флагманская модель Google для генерации видео. Она создаёт короткие ролики со звуком по текстовому описанию или из загруженного изображения. В GIPITI она доступна без VPN и с оплатой российскими картами.",
      },
      {
        question: "Какой длины получаются ролики?",
        answer:
          "От 4 до 8 секунд — длительность выбирается прямо в чате. В разрешении 1080p доступен восьмисекундный вариант; для более коротких клипов используйте 720p.",
      },
      {
        question: "Можно ли сделать видео из своей фотографии?",
        answer:
          "Да. Прикрепите изображение и опишите, что должно происходить в кадре — модель оживит картинку и добавит движение.",
      },
      ...sharedMediaFaq,
    ],
    otherModels: buildChips([
      { name: "Kling 3.0", tag: "Видео", slug: KLING_30_SLUG },
      { name: "Seedance 2.0", tag: "Видео", slug: SEEDANCE_SLUG },
      { name: "Nano Banana", tag: "Изображения", slug: NANO_BANANA_SLUG },
      {
        name: "Grok Imagine Video",
        tag: "Видео",
        slug: GROK_IMAGINE_VIDEO_SLUG,
      },
    ]),
  },
];
