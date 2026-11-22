/**
 * Landings for xAI Grok Imagine Video 1.5 and its cheaper Lite version
 * (spacexai/grok-imagine-video-1.5-lite: same sections, 480p/720p, 4/8/12 s).
 *
 * Registry facts the copy follows: 4/8/12-second clips, seven aspect ratios,
 * 480p or 720p output and an optional image input; audio is generated with the
 * video.
 */

import { NEW_USER_BONUS_SHORT_RU } from "@/lib/marketing/landing-content";
import { buildChips, buildVideoSteps, sharedMediaFaq } from "./media-shared";
import {
  GROK_IMAGINE_20_SLUG,
  GROK_IMAGINE_VIDEO_LITE_SLUG,
  GROK_IMAGINE_VIDEO_SLUG,
  SEEDANCE_25_FLASH_SLUG,
  SEEDANCE_25_SLUG,
  VEO_SLUG,
  vpnBenefit,
  WAN_30_SLUG,
} from "./shared";
import type { ModelLanding } from "./types";

export const xaiVideoLandings: ModelLanding[] = [
  {
    kind: "video",
    slug: GROK_IMAGINE_VIDEO_LITE_SLUG,
    modelId: "grok-imagine-video-lite",
    name: "Grok Imagine Video Lite",
    vendor: "xAI",
    accent: "indigo",
    badge: "xAI · Лёгкая версия · Видео",
    h1Top: "Grok Imagine Video 1.5 Lite —",
    h1Gradient: "короткие ролики со звуком от xAI",
    sub: `Лёгкая версия видеомодели xAI уже в GIPITI — ролики на 4, 8 или 12 секунд со звуком по описанию или из вашей картинки, в 480p или 720p. Дешевле Grok Imagine Video, поэтому удобно перебирать идеи. Без VPN, с оплатой российскими картами. ${NEW_USER_BONUS_SHORT_RU}.`,
    ctaMain: "Попробовать Grok Imagine Video Lite",
    metaTitle: "Grok Imagine Video Lite — видео со звуком от xAI | GIPITI",
    metaDescription:
      "Grok Imagine Video Lite в GIPITI — лёгкая и более доступная версия видеомодели xAI: ролики со звуком на 4, 8 или 12 секунд по тексту или картинке. Без VPN, оплата картами РФ.",
    heroMedia: {
      userMessage:
        "Ролик: рыжий кот осторожно идёт по заснеженной крыше, падают хлопья снега, мягкий вечерний свет, 16:9",
      aiIntro: "Готово — **скрип снега** и тихий ветер уже в ролике:",
      aspect: "16:9",
      resultCaption: "Кот на заснеженной крыше · вечерний свет",
      resultMeta: "8 секунд · 480p · 16:9 · со звуком",
    },
    benefits: [
      {
        icon: "wallet",
        title: "Дешевле Grok Imagine Video",
        text: "Lite — облегчённая версия видеомодели xAI: клип обходится дешевле полной, поэтому идею можно проверять несколькими запусками подряд.",
      },
      {
        icon: "volume",
        title: "Звук создаётся вместе с видео",
        text: "К картинке сразу добавляется звуковая дорожка — звуки сцены по описанию. Отдельная озвучка и монтаж не нужны.",
      },
      {
        icon: "ratio",
        title: "Семь форматов, 4, 8 или 12 секунд",
        text: "Соотношение сторон, длительность и разрешение — 480p или 720p — выбираются в чате перед генерацией.",
      },
      vpnBenefit,
    ],
    steps: buildVideoSteps(
      "Grok Imagine Video Lite",
      "Опишите сцену и звук — или прикрепите одну картинку и скажите, как она должна ожить."
    ),
    audience: [
      {
        title: "Тест идей для клипов",
        text: "Быстро посмотреть, как сцена выглядит и звучит, прежде чем делать финальную версию.",
        userMessage:
          "Чайка летит над маяком на закате, слышны ветер и шум волн, 16:9",
        aiReply: "**Пробный ролик** · чайка над маяком",
      },
      {
        title: "Вертикальные клипы",
        text: "Короткие ролики под сторис и ленты в формате 9:16, с музыкой под настроение.",
        userMessage:
          "Капли дождя стекают по окну кофейни, внутри тёплый свет, негромкие звуки кофейни, вертикальный кадр 9:16",
        aiReply: "**Вертикальный ролик** · дождь за окном кофейни",
      },
      {
        title: "Оживление картинок",
        text: "Открытки, иллюстрации и снимки превращаются в короткую сцену со звуком.",
        userMessage:
          "Оживи эту открытку: падает снег, на ёлке мигают гирлянды, слышен тихий звон 📎 card.jpg",
        aiReply: "**Открытка ожила** · снег и огоньки гирлянд",
      },
    ],
    faq: [
      {
        question: "Что такое Grok Imagine Video Lite?",
        answer:
          "Grok Imagine Video Lite — лёгкая версия видеомодели xAI: делает короткие ролики со звуком по тексту или из одной картинки. В GIPITI она доступна без VPN и с оплатой российскими картами.",
      },
      {
        question: "Чем Lite отличается от Grok Imagine Video?",
        answer:
          "Lite дешевле. Форматы кадра, длительность 4, 8 или 12 секунд и выбор 480p или 720p в GIPITI у двух моделей одинаковые, так что одну сцену можно прогнать на обеих и сравнить.",
      },
      {
        question: "Можно ли получить 1080p или ролик на 15 секунд?",
        answer:
          "Нет. В GIPITI доступны 480p и 720p, длительность — 4, 8 или 12 секунд. Для 1080p выберите другую модель, например Veo 3.1.",
      },
      {
        question: "Нужно ли загружать картинку?",
        answer:
          "Нет, картинка необязательна. Можно описать сцену словами, а можно прикрепить одно изображение — тогда модель оживит его.",
      },
      ...sharedMediaFaq,
    ],
    otherModels: buildChips([
      {
        name: "Grok Imagine Video",
        tag: "Видео",
        slug: GROK_IMAGINE_VIDEO_SLUG,
      },
      {
        name: "Seedance 2.5 Flash",
        tag: "Видео",
        slug: SEEDANCE_25_FLASH_SLUG,
      },
      { name: "Wan 3.0", tag: "Видео", slug: WAN_30_SLUG },
      { name: "Veo 3.1", tag: "Видео", slug: VEO_SLUG },
    ]),
  },
  {
    kind: "video",
    slug: GROK_IMAGINE_VIDEO_SLUG,
    modelId: "grok-imagine-video",
    name: "Grok Imagine Video",
    vendor: "xAI",
    accent: "violet",
    badge: "xAI · Версия 1.5 · Видео",
    h1Top: "Grok Imagine Video 1.5 —",
    h1Gradient: "ролики со звуком от xAI",
    sub: `Видеомодель xAI в версии 1.5 уже в GIPITI — короткие ролики со звуком из вашей картинки, до 12 секунд. Без VPN, на русском, с оплатой российскими картами. ${NEW_USER_BONUS_SHORT_RU}.`,
    ctaMain: "Попробовать Grok Imagine Video",
    metaTitle: "Grok Imagine Video 1.5 — видео со звуком от xAI | GIPITI",
    metaDescription:
      "Grok Imagine Video 1.5 в GIPITI — оживление картинки в ролик со звуком до 12 секунд, семь форматов кадра. Без VPN, на русском, оплата картами РФ.",
    heroMedia: {
      userMessage:
        "Оживи этот кадр: музыкант играет на саксофоне под дождём, неоновые вывески, 16:9 📎 sax.jpg",
      aiIntro: "Готово — **саксофон и шум дождя** уже в ролике:",
      aspect: "16:9",
      resultCaption: "Саксофонист под дождём · неон, ночная улица",
      resultMeta: "8 секунд · 720p · 16:9 · со звуком",
    },
    benefits: [
      {
        icon: "volume",
        title: "Звук в том же проходе",
        text: "Grok Imagine Video 1.5 генерирует звуковую дорожку вместе с картинкой: музыку, шумы и речь с синхронизацией губ — озвучивать ролик отдельно не придётся.",
      },
      {
        icon: "image",
        title: "Оживляет вашу картинку",
        text: "Прикрепите изображение и опишите движение — модель сохранит пропорции исходного кадра и добавит звук.",
      },
      {
        icon: "ratio",
        title: "Семь форматов, два разрешения",
        text: "16:9, 9:16, 1:1, 4:3, 3:4, 3:2 и 2:3, длительность 4, 8 или 12 секунд, качество 480p или 720p — всё выбирается в чате перед генерацией.",
      },
      vpnBenefit,
    ],
    steps: buildVideoSteps(
      "Grok Imagine Video",
      "Прикрепите картинку и опишите, что происходит в кадре и что должно звучать."
    ),
    audience: [
      {
        title: "Соцсети и мемы",
        text: "Короткие ролики под ленту и Reels, когда шутка актуальна прямо сейчас.",
        userMessage:
          "Оживи фото: кот-астронавт машет лапой с Луны, ретро-съёмка, 9:16 📎 cat.jpg",
        aiReply: "**Ролик 9:16** · кот-астронавт машет с Луны",
      },
      {
        title: "Говорящие персонажи",
        text: "Короткая реплика героя в кадре — голос и движение губ совпадают без ручного монтажа.",
        userMessage:
          "Оживи портрет: мастер говорит в камеру «Сегодня сделаем табурет» 📎 master.jpg",
        aiReply: "**Реплика в кадре** · голос и губы синхронны",
      },
      {
        title: "Оживление фото",
        text: "Превратить готовый кадр — товар, иллюстрацию, архивное фото — в живую сцену.",
        userMessage:
          "Оживи этот кадр: пусть ветер качает занавески и шумит листва 📎 room.jpg",
        aiReply: "**Кадр ожил** · занавески и шум листвы",
      },
    ],
    faq: [
      {
        question: "Что такое Grok Imagine Video 1.5?",
        answer:
          "Grok Imagine Video 1.5 — видеомодель xAI: оживляет загруженное изображение в короткий ролик вместе со звуком по вашему описанию. В GIPITI она доступна без VPN и с оплатой российскими картами.",
      },
      {
        question: "Какой длины ролики и есть ли в них звук?",
        answer:
          "Длительность — 4, 8 или 12 секунд, разрешение — 480p или 720p, семь вариантов соотношения сторон. Звук создаётся вместе с видео: фоновые шумы, музыка и реплики персонажей.",
      },
      {
        question: "Когда лучше выбрать другую модель?",
        answer:
          "Если нужна другая стилистика и звук, попробуйте Wan 3.0 или Seedance 2.5. Для 1080p подойдёт Veo 3.1. Grok Imagine Video удобна, когда нужен короткий ролик со звуком или нужно оживить готовую картинку.",
      },
      ...sharedMediaFaq,
    ],
    otherModels: buildChips([
      {
        name: "Grok Imagine Video Lite",
        tag: "Видео",
        slug: GROK_IMAGINE_VIDEO_LITE_SLUG,
      },
      {
        name: "Grok Imagine 2.0",
        tag: "Изображения",
        slug: GROK_IMAGINE_20_SLUG,
      },
      { name: "Wan 3.0", tag: "Видео", slug: WAN_30_SLUG },
      { name: "Veo 3.1", tag: "Видео", slug: VEO_SLUG },
      { name: "Seedance 2.5", tag: "Видео", slug: SEEDANCE_25_SLUG },
    ]),
  },
];
