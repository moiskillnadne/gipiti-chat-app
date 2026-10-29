/**
 * Landings for the Microsoft AI image models: MAI-Image 2.6 and 2.6 Flash.
 *
 * Note: neither model has a format setting in GIPITI, and the shape words in a
 * prompt do not change the output either — "wide" and "vertical" prompts both
 * came back 1024 × 1024 — so the copy promises square images only. The dedicated
 * image adapter sends a single image, so multi-reference editing and web
 * grounding are never claimed. Single-image editing does work through the
 * gateway for both models, although the catalog lists text-only input: a
 * "make the sneaker blue" edit changed only the sneaker (probed 2026-10-29).
 */

import {
  buildChips,
  buildImageSteps,
  chatIterationBenefit,
  sharedMediaFaq,
} from "./media-shared";
import {
  GPT_IMAGE_25_FLARE_SLUG,
  GPT_IMAGE_25_SUNBURST_SLUG,
  MAI_IMAGE_26_FLASH_SLUG,
  MAI_IMAGE_26_SLUG,
  NANO_BANANA_LITE_SLUG,
  NANO_BANANA_PRO_SLUG,
  SEEDREAM_LITE_SLUG,
  SEEDREAM_PRO_SLUG,
  vpnBenefit,
} from "./shared";
import type { ModelLanding } from "./types";

export const microsoftImageLandings: ModelLanding[] = [
  {
    kind: "image",
    slug: MAI_IMAGE_26_SLUG,
    modelId: "mai-image-2.6",
    name: "MAI-Image 2.6",
    vendor: "Microsoft",
    accent: "blue",
    badge: "Microsoft AI · Точные правки · Изображения",
    h1Top: "MAI-Image 2.6 —",
    h1Gradient: "нейросеть Microsoft для изображений",
    sub: "Модель Microsoft AI для генерации и редактирования изображений уже в GIPITI — точно меняет объекты, надписи и композицию по описанию на русском. Без VPN, с оплатой российскими картами. Дарим 200 ₽ каждому новому пользователю.",
    ctaMain: "Попробовать MAI-Image 2.6",
    metaTitle: "MAI-Image 2.6 — нейросеть Microsoft для картинок | GIPITI",
    metaDescription:
      "MAI-Image 2.6 в GIPITI — генерация и точное редактирование изображений от Microsoft AI: объекты, надписи, композиция. Без VPN, на русском, оплата картами РФ.",
    heroMedia: {
      userMessage:
        "Кофейня дождливым вечером через запотевшее окно: люди за столиками, тёплый свет",
      aiIntro: "Готово. Могу **точечно поправить** любую деталь:",
      aspect: "1:1",
      resultCaption: "Кофейня за дождливым окном · тёплый свет",
      resultMeta: "Фотореализм · формат 1:1",
      sample: {
        src: "/images/model-landings/mai-image-2-6/rainy-cafe.webp",
        alt: "Кофейня с посетителями за столиками, видная с улицы через мокрое от дождя стекло, — изображение, созданное MAI-Image 2.6 в GIPITI",
        width: 1024,
        height: 1024,
      },
    },
    benefits: [
      {
        icon: "wand",
        title: "Точные правки",
        text: "Заменить объект, обновить надпись, перестроить композицию или убрать лишнее — на аккуратное редактирование Microsoft и делает ставку.",
      },
      {
        icon: "image",
        title: "Генерация с нуля",
        text: "Опишите сцену словами — модель нарисует её: от репортажного кадра до рекламного визуала.",
      },
      chatIterationBenefit,
      vpnBenefit,
    ],
    steps: buildImageSteps(
      "MAI-Image 2.6",
      "Что должно быть в кадре — или прикрепите изображение и опишите правку."
    ),
    audience: [
      {
        title: "Маркетинг и e-commerce",
        text: "Варианты одного товарного кадра под разные акции — без пересъёмки.",
        userMessage:
          "Сделай кроссовок на этом фото красным, фон не меняй 📎 sneaker.jpg",
        aiReply: "**Правка** · кроссовок стал красным",
        sample: {
          src: "/images/model-landings/mai-image-2-6/red-sneaker.webp",
          alt: "Красный беговой кроссовок на бетонной ступеньке при дневном свете",
          width: 900,
          height: 900,
        },
      },
      {
        title: "Редакции и медиа",
        text: "Иллюстрации к материалам в стиле журнальной съёмки, когда фотографа нет под рукой.",
        userMessage:
          "Портрет пожилого часовщика за работой: лупа, мелкие детали, мягкий свет лампы",
        aiReply: "**Портрет** · часовщик за работой",
        sample: {
          src: "/images/model-landings/mai-image-2-6/watchmaker.webp",
          alt: "Пожилой часовщик с лупой склонился над механизмом часов в мягком свете настольной лампы",
          width: 900,
          height: 900,
        },
      },
      {
        title: "Презентации и обложки",
        text: "Живые сцены для слайдов и обложек вместо стоковых фото.",
        userMessage:
          "Картинка для слайда презентации: команда обсуждает проект в светлом офисе",
        aiReply: "**Картинка для слайда** · команда в светлом офисе",
        sample: {
          src: "/images/model-landings/mai-image-2-6/team-banner.webp",
          alt: "Команда обсуждает проект за столом с ноутбуками и стикерами в светлом офисе",
          width: 900,
          height: 900,
        },
      },
    ],
    faq: [
      {
        question: "Что такое MAI-Image 2.6?",
        answer:
          "MAI-Image 2.6 — модель Microsoft AI для генерации и редактирования изображений, ставшая общедоступной в октябре 2026 года. В GIPITI она работает без VPN, с промптом на русском и оплатой российскими картами.",
      },
      {
        question: "Чем MAI-Image 2.6 отличается от версии Flash?",
        answer:
          "MAI-Image 2.6 — версия с упором на качество, Flash — более быстрая и экономичная: по прайсу Microsoft её выходные изображения примерно вдвое дешевле. Возможности генерации и правок у них одинаковые, обе модели есть в GIPITI.",
      },
      {
        question: "Можно ли выбрать формат и разрешение?",
        answer:
          "Нет: настроек формата и разрешения у модели нет, и сейчас она отдаёт квадратные изображения 1024 × 1024, даже если попросить широкий или вертикальный кадр. Если нужен другой формат или 4K, выберите Nano Banana Pro — там соотношение сторон и качество задаются перед генерацией.",
      },
      ...sharedMediaFaq,
    ],
    otherModels: buildChips([
      {
        name: "MAI-Image 2.6 Flash",
        tag: "Изображения",
        slug: MAI_IMAGE_26_FLASH_SLUG,
      },
      {
        name: "GPT Image 2.5 Sunburst",
        tag: "Изображения",
        slug: GPT_IMAGE_25_SUNBURST_SLUG,
      },
      {
        name: "Nano Banana Pro",
        tag: "Изображения",
        slug: NANO_BANANA_PRO_SLUG,
      },
      { name: "Seedream 5.0 Pro", tag: "Изображения", slug: SEEDREAM_PRO_SLUG },
    ]),
  },
  {
    kind: "image",
    slug: MAI_IMAGE_26_FLASH_SLUG,
    modelId: "mai-image-2.6-flash",
    name: "MAI-Image 2.6 Flash",
    vendor: "Microsoft",
    accent: "sky",
    badge: "Microsoft AI · Быстро и дешевле · Изображения",
    h1Top: "MAI-Image 2.6 Flash —",
    h1Gradient: "быстрые картинки от Microsoft",
    sub: "Быстрая версия MAI-Image 2.6 уже в GIPITI — те же генерация и правки по описанию на русском, но быстрее и дешевле. Подходит, чтобы перебрать десяток идей за вечер. Без VPN, с оплатой российскими картами. Дарим 200 ₽ каждому новому пользователю.",
    ctaMain: "Попробовать MAI-Image 2.6 Flash",
    metaTitle: "MAI-Image 2.6 Flash — быстрая нейросеть Microsoft | GIPITI",
    metaDescription:
      "MAI-Image 2.6 Flash в GIPITI — быстрая и недорогая генерация и редактирование изображений от Microsoft AI. Промпт на русском, без VPN, оплата картами РФ.",
    heroMedia: {
      userMessage:
        "Акварельная открытка: домик у моря, чайки над волнами, пастельные тона",
      aiIntro: "Готово. Сделать ещё вариант в другой гамме?",
      aspect: "1:1",
      resultCaption: "Домик у моря · акварель, пастельные тона",
      resultMeta: "Акварель · открытка",
      sample: {
        src: "/images/model-landings/mai-image-2-6-flash/seaside-postcard.webp",
        alt: "Акварельная открытка с домиком у моря и чайками в пастельных тонах — изображение, созданное MAI-Image 2.6 Flash в GIPITI",
        width: 1024,
        height: 1024,
      },
    },
    benefits: [
      {
        icon: "zap",
        title: "Быстрее и дешевле",
        text: "Flash — облегчённая версия MAI-Image 2.6: по прайсу Microsoft выходные изображения у неё примерно вдвое дешевле, поэтому перебирать варианты выгоднее.",
      },
      {
        icon: "wand",
        title: "Те же правки, что у старшей версии",
        text: "Заменить объект, обновить надпись, убрать лишнее из кадра — набор возможностей совпадает с MAI-Image 2.6.",
      },
      chatIterationBenefit,
      vpnBenefit,
    ],
    steps: buildImageSteps(
      "MAI-Image 2.6 Flash",
      "Коротко опишите идею — уточнить детали можно следующим сообщением."
    ),
    audience: [
      {
        title: "SMM и контент-планы",
        text: "Картинки к ежедневным постам, когда их нужно много и быстро.",
        userMessage:
          "Картинка к посту про утренний кофе: чашка на подоконнике, за окном снег",
        aiReply: "**Картинка к посту** · кофе на зимнем подоконнике",
        sample: {
          src: "/images/model-landings/mai-image-2-6-flash/coffee-window.webp",
          alt: "Чашка кофе на подоконнике, за окном идёт снег",
          width: 900,
          height: 900,
        },
      },
      {
        title: "Перебор идей",
        text: "Концепты маскотов, упаковки и иллюстраций — десяток вариантов до того, как браться за финал.",
        userMessage:
          "Концепт маскота для пекарни: весёлый круассан в поварском колпаке, мультяшный стиль",
        aiReply: "**Концепт маскота** · круассан в колпаке",
        sample: {
          src: "/images/model-landings/mai-image-2-6-flash/croissant-mascot.webp",
          alt: "Мультяшный маскот пекарни: улыбающийся круассан в поварском колпаке",
          width: 900,
          height: 900,
        },
      },
      {
        title: "Быстрая чистка фото",
        text: "Убрать провода, прохожих и случайные предметы из кадра одной фразой.",
        userMessage:
          "Убери с этого фото провода и столб на заднем плане 📎 street.jpg",
        aiReply: "**Кадр очищен** · без проводов и столба",
        sample: {
          src: "/images/model-landings/mai-image-2-6-flash/clean-street.webp",
          alt: "Тихая улочка старого города с цветами на балконах, без проводов и столбов",
          width: 900,
          height: 900,
        },
      },
    ],
    faq: [
      {
        question: "Что такое MAI-Image 2.6 Flash?",
        answer:
          "MAI-Image 2.6 Flash — быстрая и более дешёвая версия модели Microsoft AI для генерации и редактирования изображений, вышедшая в октябре 2026 года. В GIPITI она доступна без VPN и с оплатой российскими картами.",
      },
      {
        question: "Когда лучше взять MAI-Image 2.6 вместо Flash?",
        answer:
          "Microsoft позиционирует MAI-Image 2.6 как версию с упором на качество, а Flash — как быструю и экономичную. Для черновиков и потока картинок хватает Flash; финальный визуал стоит сравнить на старшей модели — обе есть в GIPITI.",
      },
      {
        question: "Можно ли редактировать свои изображения?",
        answer:
          "Да. Прикрепите картинку в чат и опишите правку словами: заменить предмет, поправить надпись, убрать лишнее.",
      },
      ...sharedMediaFaq,
    ],
    otherModels: buildChips([
      { name: "MAI-Image 2.6", tag: "Изображения", slug: MAI_IMAGE_26_SLUG },
      {
        name: "Seedream 5.0 Lite",
        tag: "Изображения",
        slug: SEEDREAM_LITE_SLUG,
      },
      {
        name: "Nano Banana Lite",
        tag: "Изображения",
        slug: NANO_BANANA_LITE_SLUG,
      },
      {
        name: "GPT Image 2.5 Flare",
        tag: "Изображения",
        slug: GPT_IMAGE_25_FLARE_SLUG,
      },
    ]),
  },
];
