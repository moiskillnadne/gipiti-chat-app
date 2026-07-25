/**
 * Copy blocks reused across image and video landings.
 *
 * The text landings keep their own blocks in `shared.ts`; VPN/price copy is
 * shared between both and imported from there.
 */

import { priceFaq, vpnFaq } from "./shared";
import type {
  LandingBenefit,
  LandingFaqItem,
  LandingModelChip,
  LandingStep,
} from "./types";

const SIGNUP_STEP: LandingStep = {
  title: "Зарегистрируйтесь",
  text: "Аккаунт за 30 секунд — нужен только email. Дарим 200 ₽ каждому новому пользователю.",
};

const pickStep = (modelName: string): LandingStep => ({
  title: `Выберите ${modelName}`,
  text: "Переключитесь на модель в списке — в один клик, как и на любую из 30+.",
});

const DEFAULT_IMAGE_PROMPT_HINT =
  "Обычными словами: что в кадре, в каком стиле и с каким настроением.";

export const buildImageSteps = (
  modelName: string,
  promptHint: string = DEFAULT_IMAGE_PROMPT_HINT
): LandingStep[] => [
  SIGNUP_STEP,
  pickStep(modelName),
  {
    title: "Опишите картинку",
    text: promptHint,
  },
  {
    title: "Заберите результат",
    text: "Изображение появится прямо в чате — скачайте его или попросите правку.",
  },
];

const DEFAULT_VIDEO_PROMPT_HINT =
  "Что происходит в кадре, ракурс и настроение — обычными словами.";

export const buildVideoSteps = (
  modelName: string,
  promptHint: string = DEFAULT_VIDEO_PROMPT_HINT
): LandingStep[] => [
  SIGNUP_STEP,
  pickStep(modelName),
  {
    title: "Опишите сцену",
    text: promptHint,
  },
  {
    title: "Заберите ролик",
    text: "Готовое видео появится в чате — скачайте его в один клик.",
  },
];

export const russianPromptBenefit: LandingBenefit = {
  icon: "wand",
  title: "Промпт на русском",
  text: "Опишите задачу обычными словами — переводить запрос на английский не нужно. Чем подробнее описание, тем ближе результат к задумке.",
};

export const chatIterationBenefit: LandingBenefit = {
  icon: "layers",
  title: "Правки в том же чате",
  text: "Не понравился результат — скажите, что поменять, и получите новую версию. Вся серия остаётся в одном диалоге.",
};

export const historyBenefit: LandingBenefit = {
  icon: "download",
  title: "История и скачивание",
  text: "Каждая генерация сохраняется в чате: вернитесь к ней через неделю и скачайте файл в один клик.",
};

export const noSubscriptionZooBenefit: LandingBenefit = {
  icon: "wallet",
  title: "Одна подписка на все модели",
  text: "Не нужно оплачивать отдельные сервисы для картинок, видео и текста — все 30+ моделей работают с одного баланса.",
};

export const mediaHistoryFaq: LandingFaqItem = {
  question: "Где хранятся готовые файлы?",
  answer:
    "В истории чата. Откройте нужный диалог в любой момент — генерация будет на месте, файл скачивается в один клик.",
};

export const promptLanguageFaq: LandingFaqItem = {
  question: "Нужно ли писать промпт на английском?",
  answer:
    "Нет, описывайте задачу на русском. Если результат вышел не таким, добавьте деталей: что в кадре, стиль, ракурс, свет и настроение — это влияет сильнее, чем язык запроса.",
};

/** VPN + price + prompt-language — the three questions media landings share. */
export const sharedMediaFaq: LandingFaqItem[] = [
  vpnFaq,
  priceFaq,
  promptLanguageFaq,
];

/** Builds the chip list for the "Другие модели" section of a media landing. */
export const buildChips = (
  entries: readonly { name: string; tag: string; slug: string }[]
): LandingModelChip[] =>
  entries.map((entry) => ({
    name: entry.name,
    tag: entry.tag,
    href: `/models/${entry.slug}`,
  }));
