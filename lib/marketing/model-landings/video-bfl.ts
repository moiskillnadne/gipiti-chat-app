/**
 * Landing for the Black Forest Labs video model: Flux 3 Video.
 *
 * Registry facts the copy follows: 5- or 10-second clips, six aspect ratios
 * and an optional image input (text-to-video or image-to-video).
 */

import { buildChips, buildVideoSteps, sharedMediaFaq } from "./media-shared";
import {
  FLUX_SLUG,
  FLUX_VIDEO_SLUG,
  KLING_30_SLUG,
  SEEDANCE_25_SLUG,
  VEO_SLUG,
  vpnBenefit,
} from "./shared";
import type { ModelLanding } from "./types";

export const bflVideoLandings: ModelLanding[] = [
  {
    kind: "video",
    slug: FLUX_VIDEO_SLUG,
    modelId: "flux-3-video",
    name: "Flux 3 Video",
    vendor: "Black Forest Labs",
    accent: "teal",
    badge: "Black Forest Labs · Новинка · Видео",
    h1Top: "Flux 3 Video —",
    h1Gradient: "видеомодель Black Forest Labs",
    sub: "Новая видеомодель авторов Flux уже в GIPITI — ролики со звуком по описанию или из готового изображения, с фирменной картинкой Black Forest Labs. Без VPN, с оплатой российскими картами. Дарим 200 ₽ каждому новому пользователю.",
    ctaMain: "Попробовать Flux 3 Video",
    metaTitle: "Flux 3 Video — нейросеть для генерации видео | GIPITI",
    metaDescription:
      "Flux 3 Video в GIPITI — генерация видео со звуком по тексту или из изображения от Black Forest Labs. Без VPN, на русском, оплата российскими картами.",
    heroMedia: {
      userMessage:
        "Ролик: поезд идёт вдоль горного озера на рассвете, вид сбоку, 21:9",
      aiIntro: "Готово — **широкий кадр** на рассвете:",
      aspect: "16:9",
      resultCaption: "Поезд вдоль горного озера · рассвет, вид сбоку",
      resultMeta: "5 секунд · 21:9 · со звуком",
    },
    benefits: [
      {
        icon: "sparkles",
        title: "Фирменная картинка Flux",
        text: "Flux 3 обучалась на изображениях, видео и звуке разом — отсюда узнаваемая работа со светом и фактурой, за которую ценят модели Black Forest Labs.",
      },
      {
        icon: "image",
        title: "По тексту или из картинки",
        text: "Опишите сцену словами — или прикрепите изображение, и модель оживит его. Работают оба сценария, выбирать заранее не нужно.",
      },
      {
        icon: "ratio",
        title: "Шесть форматов, 5 или 10 секунд",
        text: "От вертикального 9:16 под сторис до широкого 21:9 — формат и длительность выбираются прямо в чате.",
      },
      vpnBenefit,
    ],
    steps: buildVideoSteps("Flux 3 Video"),
    audience: [
      {
        title: "Дизайнеры и арт-директора",
        text: "Атмосферные ролики с продуманным светом — для презентаций и мудбордов.",
        userMessage:
          "Дым медленно поднимается над чашкой в тёмной комнате, луч света сбоку",
        aiReply: "**Сцена** · дым в луче света, тёмная комната",
      },
      {
        title: "Бренды и реклама",
        text: "Короткие имиджевые ролики без съёмочной группы и монтажа.",
        userMessage: "Капля падает в воду крупным планом, замедленно, 16:9",
        aiReply: "**Ролик** · капля в воде, слоу-мо",
      },
      {
        title: "Авторы контента",
        text: "Оживить готовый кадр: движение, атмосфера и звук поверх вашей картинки.",
        userMessage:
          "Оживи этот кадр: пусть туман плывёт между деревьями 📎 forest.jpg",
        aiReply: "**Кадр ожил** · туман плывёт между деревьями",
      },
    ],
    faq: [
      {
        question: "Что такое Flux 3 Video?",
        answer:
          "Flux 3 Video — видеомодель Black Forest Labs, авторов серии Flux. Она создаёт ролики со звуком по текстовому описанию или из загруженного изображения. В GIPITI доступна без VPN и с оплатой российскими картами.",
      },
      {
        question: "Можно ли сделать ролик из своей картинки?",
        answer:
          "Да. Прикрепите изображение и опишите движение — модель оживит кадр. Без вложения она сгенерирует видео по одному текстовому описанию.",
      },
      {
        question: "Чем Flux 3 Video отличается от Veo 3.1?",
        answer:
          "Flux 3 ближе к визуальному языку серии Flux: свет, фактура и атмосфера кадра. Veo 3.1 сильнее в сложных сценах с речью. Обе модели доступны в GIPITI — попробуйте на своей задаче.",
      },
      ...sharedMediaFaq,
    ],
    otherModels: buildChips([
      { name: "Veo 3.1", tag: "Видео", slug: VEO_SLUG },
      { name: "Seedance 2.5", tag: "Видео", slug: SEEDANCE_25_SLUG },
      { name: "Kling 3.0", tag: "Видео", slug: KLING_30_SLUG },
      { name: "Flux 2 Max", tag: "Изображения", slug: FLUX_SLUG },
    ]),
  },
];
