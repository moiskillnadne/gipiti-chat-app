/**
 * Landing for Alibaba Wan 3.0.
 *
 * Registry facts the copy follows: text-to-video only (no image input), 5-second
 * clips only (the gateway defaults Wan to 1080p and a 5 s clip took 130 s, so longer
 * options wait for prod timing), five aspect ratios and no resolution picker; audio is
 * generated with the video.
 */

import { buildChips, buildVideoSteps, sharedMediaFaq } from "./media-shared";
import {
  GROK_IMAGINE_VIDEO_SLUG,
  QWEN_38_MAX_SLUG,
  SEEDANCE_25_SLUG,
  VEO_SLUG,
  vpnBenefit,
  WAN_30_SLUG,
} from "./shared";
import type { ModelLanding } from "./types";

export const alibabaVideoLandings: ModelLanding[] = [
  {
    kind: "video",
    slug: WAN_30_SLUG,
    modelId: "wan-v3.0-video",
    name: "Wan 3.0",
    vendor: "Alibaba",
    accent: "warm",
    badge: "Alibaba · Звук в ролике · Видео",
    h1Top: "Wan 3.0 —",
    h1Gradient: "ролики со звуком от Alibaba",
    sub: "Видеомодель Alibaba уже в GIPITI — ролики со звуком по текстовому описанию: сцена с шумом улицы, шагами и музыкой создаётся за один проход. Без VPN, на русском, с оплатой российскими картами. Дарим 200 ₽ каждому новому пользователю.",
    ctaMain: "Попробовать Wan 3.0",
    metaTitle: "Wan 3.0 — нейросеть Alibaba для видео со звуком | GIPITI",
    metaDescription:
      "Wan 3.0 в GIPITI — генерация видео со звуком по описанию на русском, пять форматов кадра, ролики по 5 секунд. Нейросеть Alibaba без VPN, оплата российскими картами.",
    heroMedia: {
      userMessage:
        "Ролик на 5 секунд: утренний рынок в старом городе, торговцы раскладывают фрукты, гул голосов, 16:9",
      aiIntro: "Готово — **5 секунд** вместе со звуком рынка:",
      aspect: "16:9",
      resultCaption: "Утренний рынок · торговцы раскладывают фрукты",
      resultMeta: "5 секунд · 16:9 · со звуком",
    },
    benefits: [
      {
        icon: "video",
        title: "Сцена со звуком за одну генерацию",
        text: "Ролик на 5 секунд: короткая сцена с действием, где картинка и звук уже собраны вместе. Генерация тарифицируется посекундно, поэтому идею удобно быстро проверить и доработать промпт.",
      },
      {
        icon: "volume",
        title: "Звук рождается вместе с картинкой",
        text: "Шум улицы, шаги, музыка на фоне — Wan 3.0 создаёт звуковую дорожку в том же проходе, что и видео, без отдельной озвучки.",
      },
      {
        icon: "ratio",
        title: "Пять форматов кадра",
        text: "16:9 для YouTube, 9:16 для Reels и сторис, квадрат для ленты, а также 4:3 и 3:4 — формат кадра выбирается прямо в чате.",
      },
      vpnBenefit,
    ],
    steps: buildVideoSteps(
      "Wan 3.0",
      "Расскажите, что происходит от первой до последней секунды, какие звуки слышны и какой нужен формат."
    ),
    audience: [
      {
        title: "Блогеры и авторы каналов",
        text: "Цельные сцены для роликов и Shorts: действие успевает начаться и закончиться в одном клипе.",
        userMessage:
          "5 секунд: путешественник выходит на вершину холма, ветер в траве, панорама долины",
        aiReply: "**5 секунд** · вершина холма и панорама долины",
      },
      {
        title: "Малый бизнес и реклама",
        text: "Рекламный ролик для соцсетей с сюжетом и звуком — без съёмочной площадки и монтажёра.",
        userMessage:
          "Ролик для пекарни на 5 секунд: свежий хлеб достают из печи, пар, тёплый свет, 9:16",
        aiReply: "**5 секунд, 9:16** · хлеб из печи",
      },
      {
        title: "Преподаватели и обучение",
        text: "Наглядные сцены для уроков и презентаций: процесс целиком, а не один застывший момент.",
        userMessage:
          "Покажи, как над горами собирается дождевая туча и начинается ливень, 5 секунд, 4:3",
        aiReply: "**Ливень в горах** · 5 секунд, 4:3",
      },
    ],
    faq: [
      {
        question: "Что такое Wan 3.0?",
        answer:
          "Wan 3.0 — видеомодель Alibaba, вышедшая в августе 2026 года. Она генерирует ролики вместе со звуком: картинка и звуковая дорожка создаются за один проход. В GIPITI модель доступна без VPN, с промптом на русском и оплатой российскими картами.",
      },
      {
        question: "Какой длины бывают ролики и сколько они стоят?",
        answer:
          "Сейчас в GIPITI ролики Wan 3.0 длятся 5 секунд, формат — 16:9, 9:16, 1:1, 4:3 или 3:4. Модель тарифицируется за каждую секунду видео, а стоимость генерации списывается с баланса после того, как ролик готов.",
      },
      {
        question: "Можно ли сделать видео из своей картинки?",
        answer:
          "Сейчас Wan 3.0 в GIPITI работает по текстовому описанию. Чтобы оживить готовое изображение, выберите Veo 3.1, Seedance 2.5 или Kling 3.0 Image-to-Video — им можно прикрепить картинку прямо в чате.",
      },
      ...sharedMediaFaq,
    ],
    otherModels: buildChips([
      { name: "Veo 3.1", tag: "Видео", slug: VEO_SLUG },
      { name: "Seedance 2.5", tag: "Видео", slug: SEEDANCE_25_SLUG },
      {
        name: "Grok Imagine Video",
        tag: "Видео",
        slug: GROK_IMAGINE_VIDEO_SLUG,
      },
      { name: "Qwen 3.8 Max", tag: "Текст", slug: QWEN_38_MAX_SLUG },
    ]),
  },
];
