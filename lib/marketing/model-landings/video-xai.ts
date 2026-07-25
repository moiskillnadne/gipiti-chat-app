/**
 * Landing for xAI Grok Imagine Video.
 *
 * Registry facts the copy follows: 4/8/12-second clips, seven aspect ratios,
 * 480p or 720p output and an optional image input.
 */

import { buildChips, buildVideoSteps, sharedMediaFaq } from "./media-shared";
import {
  GROK_IMAGINE_SLUG,
  GROK_IMAGINE_VIDEO_SLUG,
  KLING_25_TURBO_SLUG,
  SEEDANCE_FAST_SLUG,
  VEO_SLUG,
  vpnBenefit,
} from "./shared";
import type { ModelLanding } from "./types";

export const xaiVideoLandings: ModelLanding[] = [
  {
    kind: "video",
    slug: GROK_IMAGINE_VIDEO_SLUG,
    modelId: "grok-imagine-video",
    name: "Grok Imagine Video",
    vendor: "xAI",
    accent: "violet",
    badge: "xAI · Короткие ролики · Видео",
    h1Top: "Grok Imagine Video —",
    h1Gradient: "видео по промпту от xAI",
    sub: "Видеомодель xAI уже в GIPITI — короткие ролики по текстовому описанию или из готовой картинки, до 12 секунд. Без VPN, с оплатой российскими картами. Дарим 200 ₽ каждому новому пользователю.",
    ctaMain: "Попробовать Grok Imagine Video",
    metaTitle: "Grok Imagine Video — генерация видео от xAI | GIPITI",
    metaDescription:
      "Grok Imagine Video в GIPITI — короткие ролики по описанию или из изображения, до 12 секунд и семь форматов кадра. Без VPN, оплата российскими картами.",
    heroMedia: {
      userMessage:
        "Ролик: бумажный кораблик плывёт по луже, отражение неона, 16:9",
      aiIntro: "Готово. Могу удлинить ролик или сменить ракурс:",
      aspect: "16:9",
      resultCaption: "Кораблик в луже · отражение неона, ночь",
      resultMeta: "8 секунд · 720p · 16:9",
    },
    benefits: [
      {
        icon: "video",
        title: "Ролики до 12 секунд",
        text: "Четыре, восемь или двенадцать секунд — самая длинная заготовка среди быстрых видеомоделей в GIPITI.",
      },
      {
        icon: "ratio",
        title: "Семь форматов кадра",
        text: "16:9 для ленты, 9:16 для сторис, квадрат для превью и ещё четыре пропорции — плюс выбор разрешения 480p или 720p.",
      },
      {
        icon: "image",
        title: "По тексту или из картинки",
        text: "Опишите сцену словами или прикрепите изображение — модель оживит готовый кадр.",
      },
      vpnBenefit,
    ],
    steps: buildVideoSteps("Grok Imagine Video"),
    audience: [
      {
        title: "Соцсети и мемы",
        text: "Короткие ролики под ленту, когда идея нужна прямо сейчас.",
        userMessage: "Кот в костюме астронавта машет лапой, ретро-съёмка",
        aiReply: "**Ролик** · кот-астронавт машет лапой",
      },
      {
        title: "Авторы каналов",
        text: "Заставки и вставки под видео — в нужном формате и длительности.",
        userMessage: "Заставка: логотип собирается из частиц, 12 секунд",
        aiReply: "**Заставка** · логотип из частиц, 12 секунд",
      },
      {
        title: "Быстрые концепты",
        text: "Показать идею ролика заказчику до того, как считать бюджет продакшна.",
        userMessage: "Оживи этот кадр: пусть машина едет по трассе 📎 car.jpg",
        aiReply: "**Кадр ожил** · машина едет по трассе",
      },
    ],
    faq: [
      {
        question: "Что такое Grok Imagine Video?",
        answer:
          "Grok Imagine Video — модель xAI для генерации коротких видео по текстовому описанию или из загруженного изображения. В GIPITI она доступна без VPN и с оплатой российскими картами.",
      },
      {
        question: "Какой длины и качества получаются ролики?",
        answer:
          "Длительность — 4, 8 или 12 секунд, разрешение — 480p или 720p. Оба параметра выбираются прямо в чате перед генерацией.",
      },
      {
        question: "Когда лучше выбрать другую модель?",
        answer:
          "Если нужен ролик со звуком и кинематографичной картинкой, возьмите Veo 3.1 или Kling 3.0. Grok Imagine Video выигрывает в скорости и длительности заготовки.",
      },
      ...sharedMediaFaq,
    ],
    otherModels: buildChips([
      { name: "Grok Imagine", tag: "Изображения", slug: GROK_IMAGINE_SLUG },
      { name: "Veo 3.1", tag: "Видео", slug: VEO_SLUG },
      { name: "Kling 2.5 Turbo", tag: "Видео", slug: KLING_25_TURBO_SLUG },
      { name: "Seedance 2.0 Fast", tag: "Видео", slug: SEEDANCE_FAST_SLUG },
    ]),
  },
];
