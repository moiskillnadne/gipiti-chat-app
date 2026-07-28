/**
 * Landings for the Google image models — the Nano Banana family.
 *
 * Resolution claims follow the registry: the Pro and regular models expose
 * 1K/2K/4K, while Lite is 1K-only (Google rejects larger sizes for it), so its
 * copy never promises 2K or 4K.
 */

import { buildChips, buildImageSteps, sharedMediaFaq } from "./media-shared";
import {
  FLUX_SLUG,
  GPT_IMAGE_SLUG,
  NANO_BANANA_LITE_SLUG,
  NANO_BANANA_PRO_SLUG,
  NANO_BANANA_SLUG,
  SEEDREAM_LITE_SLUG,
  SOL_SLUG,
  VEO_SLUG,
  vpnBenefit,
} from "./shared";
import type { ModelLanding } from "./types";

export const googleImageLandings: ModelLanding[] = [
  {
    kind: "image",
    slug: NANO_BANANA_SLUG,
    modelId: "gemini-3.1-flash-image",
    name: "Nano Banana",
    vendor: "Google",
    accent: "warm",
    badge: "Google · Генерация и редактирование · Изображения",
    h1Top: "Nano Banana —",
    h1Gradient: "нейросеть для картинок на русском",
    sub: "Самая популярная модель Google для изображений уже в GIPITI — рисует по описанию и точно правит готовые картинки. Без VPN, на русском, с оплатой российскими картами. Дарим 200 ₽ каждому новому пользователю.",
    ctaMain: "Попробовать Nano Banana",
    metaTitle: "Nano Banana — нейросеть для генерации изображений | GIPITI",
    metaDescription:
      "Nano Banana в GIPITI — генерация и редактирование изображений по описанию на русском: замена фона, стиля и деталей. Без VPN, оплата российскими картами. Дарим 200 ₽ новым пользователям.",
    heroMedia: {
      userMessage:
        "Нарисуй рыжего кота в очках, который читает газету в кофейне, тёплый свет, 16:9",
      aiIntro: "Готово. Скажите, что поправить — сделаю новую версию:",
      aspect: "16:9",
      resultCaption: "Рыжий кот в очках с газетой · кофейня, тёплый свет",
      resultMeta: "Формат 16:9",
      sample: {
        src: "/images/model-landings/nano-banana/cat-in-a-cafe.webp",
        alt: "Рыжий кот в очках читает газету за столиком кофейни — изображение, созданное Nano Banana в GIPITI",
        width: 1280,
        height: 714,
      },
    },
    benefits: [
      {
        icon: "image",
        title: "Рисует по описанию",
        text: "Опишите картинку словами — модель нарисует её с нуля: от фотореалистичного кадра до плоской иллюстрации в нужном стиле.",
      },
      {
        icon: "wand",
        title: "Правит готовые изображения",
        text: "Прикрепите свою картинку и скажите, что изменить: заменить фон, убрать лишний объект, поменять цвет или стиль — остальное останется на месте.",
      },
      {
        icon: "ratio",
        title: "Форматы и качество на выбор",
        text: "Квадрат для аватарки, 16:9 для обложки, 9:16 для сторис — десять соотношений сторон и качество вплоть до 4K.",
      },
      vpnBenefit,
    ],
    steps: buildImageSteps("Nano Banana"),
    audience: [
      {
        title: "Маркетологи и SMM",
        text: "Обложки постов, баннеры и креативы — без стоков и дизайнера на подхвате.",
        userMessage:
          "Обложка для поста о распродаже: неоновые цифры −50% на тёмном фоне, 16:9",
        aiReply: "**Обложка 16:9** · неоновые цифры на тёмном фоне",
        sample: {
          src: "/images/model-landings/nano-banana/discount.webp",
          alt: "Обложка поста о распродаже: неоновая надпись −50% на фоне ночного города",
          width: 900,
          height: 502,
        },
      },
      {
        title: "Владельцы магазинов",
        text: "Карточки товара и предметная съёмка: замена фона и подгонка под формат площадки.",
        userMessage:
          "Убери фон у фото товара и поставь его на светлую студийную поверхность 📎",
        aiReply: "**Фон заменён** · товар на светлой студийной подложке",
        sample: {
          src: "/images/model-landings/nano-banana/removed-background.webp",
          alt: "Флакон парфюма на светлой студийной поверхности после замены фона",
          width: 900,
          height: 502,
        },
      },
      {
        title: "Блогеры и авторы",
        text: "Иллюстрации к статьям и сторис — в едином стиле и нужном формате.",
        userMessage:
          "Иллюстрация к статье про удалённую работу, плоский стиль, три цвета",
        aiReply: "**Плоская иллюстрация** · три цвета, под стиль блога",
        sample: {
          src: "/images/model-landings/nano-banana/remote-work.webp",
          alt: "Плоская иллюстрация про удалённую работу: девушка с ноутбуком за домашним столом",
          width: 900,
          height: 502,
        },
      },
    ],
    faq: [
      {
        question: "Что такое Nano Banana?",
        answer:
          "Nano Banana — модель Google для генерации и редактирования изображений (в каталоге Google она же Gemini 3.1 Flash Image). В GIPITI она доступна без VPN, с интерфейсом на русском языке и оплатой российскими картами.",
      },
      {
        question: "Можно ли редактировать свои изображения?",
        answer:
          "Да. Прикрепите картинку прямо в чат и опишите правку словами — модель изменит только то, о чём вы попросили, и вернёт новую версию. Исходник останется в истории.",
      },
      {
        question: "Чем Nano Banana отличается от версии Pro?",
        answer:
          "Pro точнее следует сложному описанию и аккуратнее пишет текст на самой картинке. Обычная Nano Banana быстрее и дешевле — её хватает для большинства задач. Обе модели доступны в GIPITI.",
      },
      ...sharedMediaFaq,
    ],
    otherModels: buildChips([
      {
        name: "Nano Banana Pro",
        tag: "Изображения",
        slug: NANO_BANANA_PRO_SLUG,
      },
      {
        name: "Nano Banana Lite",
        tag: "Изображения",
        slug: NANO_BANANA_LITE_SLUG,
      },
      { name: "GPT Image 2", tag: "Изображения", slug: GPT_IMAGE_SLUG },
      { name: "Veo 3.1", tag: "Видео", slug: VEO_SLUG },
    ]),
  },
  {
    kind: "image",
    slug: NANO_BANANA_PRO_SLUG,
    modelId: "gemini-3-pro-image",
    name: "Nano Banana Pro",
    vendor: "Google",
    accent: "indigo",
    badge: "Google · Максимум качества · Изображения",
    h1Top: "Nano Banana Pro —",
    h1Gradient: "точная генерация изображений",
    sub: "Продвинутая модель Google для изображений уже в GIPITI — точно следует сложному описанию и аккуратно пишет текст прямо на картинке. Без VPN, на русском, с оплатой российскими картами. Дарим 200 ₽ каждому новому пользователю.",
    ctaMain: "Попробовать Nano Banana Pro",
    metaTitle: "Nano Banana Pro — генерация изображений с текстом | GIPITI",
    metaDescription:
      "Nano Banana Pro в GIPITI — продвинутая модель Google для изображений: точное следование промпту, надписи на картинке и качество до 4K. Без VPN, оплата российскими картами.",
    heroMedia: {
      userMessage:
        "Постер кофейни: чашка на деревянном столе, сверху крупная надпись «Утро начинается здесь», 1:1",
      aiIntro: "Собрал постер с надписью. Проверьте текст на макете:",
      aspect: "1:1",
      resultCaption: "Постер кофейни · надпись «Утро начинается здесь»",
      resultMeta: "Формат 1:1",
      sample: {
        src: "/images/model-landings/nano-banana-pro/coffee-poster.webp",
        alt: "Постер кофейни с крупной надписью «Утро начинается здесь» и чашкой капучино — изображение, созданное Nano Banana Pro в GIPITI",
        width: 1024,
        height: 1024,
      },
    },
    benefits: [
      {
        icon: "sparkles",
        title: "Точно следует описанию",
        text: "Сложный промпт с несколькими объектами, ракурсом и светом — Pro-версия удерживает все условия сразу, а не половину из них.",
      },
      {
        icon: "pen",
        title: "Умеет писать текст на картинке",
        text: "Заголовки на постерах, надписи на упаковке и вывески — Pro справляется с текстом на изображении заметно лучше обычных моделей.",
      },
      {
        icon: "wand",
        title: "Редактирует до мелочей",
        text: "Прикрепите изображение и опишите правку: поменять предмет, свет или ракурс — модель сохранит остальную сцену.",
      },
      vpnBenefit,
    ],
    steps: buildImageSteps(
      "Nano Banana Pro",
      "Чем подробнее описание — объекты, стиль, свет, ракурс, — тем точнее результат."
    ),
    audience: [
      {
        title: "Дизайнеры и маркетологи",
        text: "Постеры и макеты с надписями — черновик за минуту вместо часа в редакторе.",
        userMessage:
          "Афиша концерта: силуэт гитариста, неон, надпись «Live · 12 октября»",
        aiReply: "**Афиша 1:1** · неон, надпись «Live · 12 октября»",
        sample: {
          src: "/images/model-landings/nano-banana-pro/neon-poster.webp",
          alt: "Афиша концерта: гитарист в неоновых лучах и надпись «Live · 12 октября»",
          width: 900,
          height: 900,
        },
      },
      {
        title: "Бренды и e-commerce",
        text: "Упаковка, этикетки и рекламные визуалы с текстом на самой картинке.",
        userMessage:
          "Этикетка для кофе: минимализм, крафтовая бумага, надпись «Эспрессо 250 г»",
        aiReply: "**Этикетка** · крафт, минимализм, надпись «Эспрессо 250 г»",
        sample: {
          src: "/images/model-landings/nano-banana-pro/espresso-label.webp",
          alt: "Этикетка кофе на крафтовой бумаге с надписью «Эспрессо 250 г»",
          width: 900,
          height: 900,
        },
      },
      {
        title: "Иллюстраторы",
        text: "Сложные сцены с точным светом и композицией — как референс или готовый кадр.",
        userMessage:
          "Сцена: библиотека ночью, свет от лампы, пыль в воздухе, вид сверху",
        aiReply:
          "**Ночная библиотека** · свет лампы, пыль в воздухе, вид сверху",
        sample: {
          src: "/images/model-landings/nano-banana-pro/library.webp",
          alt: "Ночная библиотека: стол под настольной лампой между книжных стеллажей, вид сверху",
          width: 900,
          height: 900,
        },
      },
    ],
    faq: [
      {
        question: "Что такое Nano Banana Pro?",
        answer:
          "Nano Banana Pro — продвинутая модель Google для генерации и редактирования изображений (Gemini 3 Pro Image). В GIPITI она доступна без VPN, с интерфейсом на русском языке и оплатой российскими картами.",
      },
      {
        question: "Хорошо ли модель пишет текст на русском?",
        answer:
          "Заметно лучше большинства моделей, но не идеально: длинные надписи и редкие шрифты иногда «плывут». Если буквы получились неровными, повторите генерацию или сделайте надпись короче — обычно помогает.",
      },
      {
        question: "Чем Pro отличается от обычной Nano Banana?",
        answer:
          "Pro точнее выполняет сложные описания и лучше работает с текстом на изображении, но стоит дороже за генерацию. Для простых картинок обычной Nano Banana достаточно — обе модели доступны в GIPITI.",
      },
      ...sharedMediaFaq,
    ],
    otherModels: buildChips([
      { name: "Nano Banana", tag: "Изображения", slug: NANO_BANANA_SLUG },
      { name: "GPT Image 2", tag: "Изображения", slug: GPT_IMAGE_SLUG },
      { name: "Flux 2 Max", tag: "Изображения", slug: FLUX_SLUG },
      { name: "GPT-5.6 Sol", tag: "Текст", slug: SOL_SLUG },
    ]),
  },
  {
    kind: "image",
    slug: NANO_BANANA_LITE_SLUG,
    modelId: "gemini-3.1-flash-lite-image",
    name: "Nano Banana Lite",
    vendor: "Google",
    accent: "sky",
    badge: "Google · Самая недорогая · Изображения",
    h1Top: "Nano Banana Lite —",
    h1Gradient: "быстрая генерация картинок",
    sub: "Самая лёгкая модель Google для изображений уже в GIPITI — быстрые картинки по минимальной цене, когда нужно перебрать десяток вариантов. Без VPN, на русском, с оплатой российскими картами. Дарим 200 ₽ каждому новому пользователю.",
    ctaMain: "Попробовать Nano Banana Lite",
    metaTitle: "Nano Banana Lite — быстрая генерация изображений | GIPITI",
    metaDescription:
      "Nano Banana Lite в GIPITI — самая недорогая модель Google для картинок: быстрые генерации и черновики в разрешении 1K. Без VPN, на русском, оплата российскими картами.",
    heroMedia: {
      userMessage:
        "Набросай пять вариантов иконки приложения для заметок, минимализм, 1:1",
      aiIntro: "Первый вариант готов — идём дальше по списку:",
      aspect: "1:1",
      resultCaption: "Иконка заметок · минимализм, мягкие тени",
      resultMeta: "Качество 1K · формат 1:1",
      sample: {
        src: "/images/model-landings/nano-banana-lite/notes-icons.webp",
        alt: "Минималистичные иконки приложения для заметок на экране смартфона — изображение, созданное Nano Banana Lite в GIPITI",
        width: 1024,
        height: 1024,
      },
    },
    benefits: [
      {
        icon: "zap",
        title: "Быстро и дёшево",
        text: "Самая недорогая модель для картинок в GIPITI: можно перебрать десяток идей и не следить за балансом.",
      },
      {
        icon: "layers",
        title: "Идеальна для черновиков",
        text: "Проверить композицию, подобрать стиль, показать идею коллеге — а финальный кадр отрисовать старшей моделью.",
      },
      {
        icon: "ratio",
        title: "Десять форматов кадра",
        text: "От квадрата до 21:9 — выбирайте пропорции под площадку. Разрешение — 1K: этого хватает для соцсетей и превью.",
      },
      vpnBenefit,
    ],
    steps: buildImageSteps("Nano Banana Lite"),
    audience: [
      {
        title: "SMM и контент-менеджеры",
        text: "Картинки к постам каждый день — быстро, много и без лишних затрат.",
        userMessage: "Пять фонов для сторис в пастельных тонах, 9:16",
        aiReply: "**Фон 1 из 5** · пастельный градиент, 9:16",
        sample: {
          src: "/images/model-landings/nano-banana-lite/pastel-gradient.webp",
          alt: "Вертикальный фон для сторис: плавный пастельный градиент",
          width: 502,
          height: 900,
        },
      },
      {
        title: "Продакт-менеджеры",
        text: "Быстрые визуалы для презентаций и макетов — вместо поиска по стокам.",
        userMessage:
          "Простая иллюстрация для слайда: команда за столом, флэт-стиль",
        aiReply: "**Флэт-иллюстрация** · команда за столом, три цвета",
        sample: {
          src: "/images/model-landings/nano-banana-lite/team-flat-style.webp",
          alt: "Флэт-иллюстрация для слайда: команда за столом переговоров",
          width: 900,
          height: 502,
        },
      },
      {
        title: "Все, кто перебирает идеи",
        text: "Десяток набросков подряд, чтобы понять направление, — и только потом финальный кадр.",
        userMessage:
          "Покажи три варианта логотипа кофейни: чашка, зерно, улыбка",
        aiReply: "**Вариант 1** · чашка в круге, тонкие линии",
        sample: {
          src: "/images/model-landings/nano-banana-lite/coffee-logo.webp",
          alt: "Три варианта логотипа кофейни: чашка, кофейное зерно и улыбка",
          width: 900,
          height: 502,
        },
      },
    ],
    faq: [
      {
        question: "Что такое Nano Banana Lite?",
        answer:
          "Nano Banana Lite — лёгкая и самая недорогая модель Google для генерации изображений (Gemini 3.1 Flash Lite Image). В GIPITI она доступна без VPN, с интерфейсом на русском языке и оплатой российскими картами.",
      },
      {
        question: "В каком разрешении приходят изображения?",
        answer:
          "В 1K — это ограничение самой модели. Для соцсетей, превью и черновиков подходит; если нужен кадр в 2K или 4K, выберите Nano Banana или Nano Banana Pro.",
      },
      {
        question: "Когда стоит выбрать модель постарше?",
        answer:
          "Когда важны детали: сложная сцена, надписи на картинке или печать. Тогда возьмите Nano Banana Pro. Lite — про скорость, количество вариантов и цену.",
      },
      ...sharedMediaFaq,
    ],
    otherModels: buildChips([
      { name: "Nano Banana", tag: "Изображения", slug: NANO_BANANA_SLUG },
      {
        name: "Nano Banana Pro",
        tag: "Изображения",
        slug: NANO_BANANA_PRO_SLUG,
      },
      {
        name: "Seedream 5.0 Lite",
        tag: "Изображения",
        slug: SEEDREAM_LITE_SLUG,
      },
      { name: "Flux 2 Max", tag: "Изображения", slug: FLUX_SLUG },
    ]),
  },
];
