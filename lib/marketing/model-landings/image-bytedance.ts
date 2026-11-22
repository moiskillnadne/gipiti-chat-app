/**
 * Landings for the ByteDance image models: Seedream 5.5, 5.0 Pro, 5.0 Lite
 * and 4.5. Seedream 5.5 ships without a watermark (the app sends
 * bytedance.watermark=false) and has no 4K or PDF input.
 */

import { NEW_USER_BONUS_SHORT_RU } from "@/lib/marketing/landing-content";
import {
  buildChips,
  buildImageSteps,
  historyBenefit,
  russianPromptBenefit,
  sharedMediaFaq,
} from "./media-shared";
import {
  FLUX_SLUG,
  GPT_IMAGE_25_SUNBURST_SLUG,
  GPT_IMAGE_26_SUNBURST_SLUG,
  NANO_BANANA_SLUG,
  SEEDANCE_25_FLASH_SLUG,
  SEEDANCE_25_SLUG,
  SEEDREAM_45_SLUG,
  SEEDREAM_55_SLUG,
  SEEDREAM_LITE_SLUG,
  SEEDREAM_PRO_SLUG,
  vpnBenefit,
} from "./shared";
import type { ModelLanding } from "./types";

export const bytedanceImageLandings: ModelLanding[] = [
  {
    kind: "image",
    slug: SEEDREAM_55_SLUG,
    modelId: "seedream-5.5",
    name: "Seedream 5.5",
    vendor: "ByteDance",
    accent: "rose",
    badge: "ByteDance · Надписи и правки · Изображения",
    h1Top: "Seedream 5.5 —",
    h1Gradient: "нейросеть ByteDance для афиш и правок",
    sub: `Новая модель ByteDance для изображений уже в GIPITI — вписывает надписи в кадр, точно правит загруженные картинки и сохраняет облик объекта. Восемь форматов, результат без водяного знака. Без VPN, с оплатой российскими картами. ${NEW_USER_BONUS_SHORT_RU}.`,
    metaTitle: "Seedream 5.5 — нейросеть ByteDance для изображений | GIPITI",
    metaDescription:
      "Seedream 5.5 в GIPITI — модель ByteDance для афиш с надписями, маркетинговых визуалов и точного редактирования, восемь форматов кадра. Без VPN, оплата картами РФ.",
    heroMedia: {
      userMessage:
        "Афиша джазового вечера: крупная надпись «ДЖАЗ НА КРЫШЕ», силуэт саксофона на фоне города на закате, бирюзовый и оранжевый, квадратный кадр",
      aiIntro: "Готово — **заголовок** читается, макет можно дорабатывать:",
      aspect: "1:1",
      resultCaption: "Афиша «Джаз на крыше» · саксофон и закат",
      resultMeta: "Афиша · формат 1:1",
      sample: {
        src: "/images/model-landings/seedream-5-5/jazz-poster.webp",
        alt: "Афиша в стиле ретро: крупный заголовок «ДЖАЗ НА КРЫШЕ», саксофон на фоне городских крыш и оранжевого заката — изображение, созданное Seedream 5.5 в GIPITI",
        width: 1280,
        height: 1280,
      },
    },
    benefits: [
      {
        icon: "palette",
        title: "Надписи прямо в кадре",
        text: "Заголовок афиши, вывеска или плакат — модель вписывает короткий текст в изображение. Проверьте написание в результате и при необходимости попросите поправить.",
      },
      {
        icon: "wand",
        title: "Точные правки с сохранением объекта",
        text: "Загрузите картинку и опишите замену: другие цветы в вазе, новый цвет, другой фон. Предмет, который менять не просили, остаётся узнаваемым.",
      },
      {
        icon: "ratio",
        title: "Восемь форматов кадра",
        text: "От квадрата до широкого 21:9, включая 16:9, 9:16, 4:3, 3:4, 3:2 и 2:3 — под баннер, афишу, карточку или сторис.",
      },
      vpnBenefit,
    ],
    steps: buildImageSteps(
      "Seedream 5.5",
      "Опишите кадр и, если нужна надпись, напишите её в кавычках; затем выберите формат."
    ),
    audience: [
      {
        title: "Кафе и рестораны",
        text: "Вывески, штендеры и рекламные кадры с короткой надписью — без дизайнера и макета.",
        userMessage:
          "Штендер у кафе утром: на чёрной доске мелом написано «ЗАВТРАКИ», ниже нарисованы круассан и чашка кофе",
        aiReply: "**Вывеска** · «ЗАВТРАКИ» мелом на доске",
        sample: {
          src: "/images/model-landings/seedream-5-5/chalkboard.webp",
          alt: "Чёрная доска-штендер у кафе с меловой надписью «ЗАВТРАКИ» и рисунками круассана и чашки кофе в утреннем свете",
          width: 900,
          height: 900,
        },
      },
      {
        title: "Интерьерные студии",
        text: "Атмосферные кадры комнат для каталога, соцсетей или презентации идеи клиенту.",
        userMessage:
          "Уголок для чтения: горчичное бархатное кресло у высокого окна, стопка книг на табурете, плед, за окном дождь, тёплая лампа",
        aiReply: "**Интерьер** · кресло у окна, дождь",
        sample: {
          src: "/images/model-landings/seedream-5-5/reading-nook.webp",
          alt: "Горчичное бархатное кресло с пледом и подушкой у высокого окна с каплями дождя, рядом стопка книг на табурете и лампа",
          width: 900,
          height: 900,
        },
      },
      {
        title: "Флористы и магазины декора",
        text: "Новые варианты букета или композиции на том же снимке, без повторной съёмки.",
        userMessage:
          "Замени красные тюльпаны в стеклянной вазе на белые анемоны, вазу, стол, стену и свет оставь как есть 📎 vase.jpg",
        aiReply: "**Правка** · анемоны вместо тюльпанов",
        sample: {
          src: "/images/model-landings/seedream-5-5/white-anemones.webp",
          alt: "Прозрачная стеклянная ваза с белыми анемонами с тёмной серединкой на белом столе у светлой стены",
          width: 900,
          height: 900,
        },
      },
    ],
    faq: [
      {
        question: "Что такое Seedream 5.5?",
        answer:
          "Seedream 5.5 — модель ByteDance для создания изображений по тексту и по загруженным картинкам. Она рассчитана на дизайн и маркетинг: точные правки, сохранение облика объекта и надписи в кадре. В GIPITI доступна без VPN и с оплатой российскими картами.",
      },
      {
        question: "Есть ли на изображениях водяной знак?",
        answer:
          "Нет. Результаты Seedream 5.5 в GIPITI приходят без водяного знака, их можно сразу скачивать и использовать в макетах.",
      },
      {
        question: "Чем Seedream 5.5 отличается от 5.0 Pro?",
        answer:
          "5.5 — более новая версия, а 5.0 Pro остаётся в GIPITI. Форматы кадра и правки загруженных картинок у них те же, так что одну и ту же идею легко прогнать на обеих и выбрать вариант, который нравится больше.",
      },
      {
        question: "Можно ли получить 4K или загрузить PDF?",
        answer:
          "Нет: размер кадра определяется выбранным форматом, 4K не предусмотрен, а документы PDF модель в GIPITI не принимает. Загружать можно изображения.",
      },
      ...sharedMediaFaq,
    ],
    otherModels: buildChips([
      {
        name: "Seedream 5.0 Pro",
        tag: "Изображения",
        slug: SEEDREAM_PRO_SLUG,
      },
      {
        name: "Seedream 5.0 Lite",
        tag: "Изображения",
        slug: SEEDREAM_LITE_SLUG,
      },
      {
        name: "GPT Image 2.6 Sunburst",
        tag: "Изображения",
        slug: GPT_IMAGE_26_SUNBURST_SLUG,
      },
      {
        name: "Seedance 2.5 Flash",
        tag: "Видео",
        slug: SEEDANCE_25_FLASH_SLUG,
      },
    ]),
  },
  {
    kind: "image",
    slug: SEEDREAM_PRO_SLUG,
    modelId: "seedream-5.0-pro",
    name: "Seedream 5.0 Pro",
    vendor: "ByteDance",
    accent: "warm",
    badge: "ByteDance · Старшая модель · Изображения",
    h1Top: "Seedream 5.0 Pro —",
    h1Gradient: "фотореализм и точное редактирование",
    sub: `Старшая модель ByteDance для изображений уже в GIPITI — сложные реалистичные сцены, аккуратный свет и точный контроль правок. Без VPN, с оплатой российскими картами. ${NEW_USER_BONUS_SHORT_RU}.`,
    metaTitle: "Seedream 5.0 Pro — генерация изображений ByteDance | GIPITI",
    metaDescription:
      "Seedream 5.0 Pro в GIPITI — старшая модель ByteDance: фотореалистичные сцены, предметная съёмка и точное редактирование по описанию на русском. Без VPN, оплата российскими картами.",
    heroMedia: {
      userMessage:
        "Студийное фото флакона духов на камне, янтарная жидкость, мягкий градиентный фон, квадратный кадр",
      aiIntro: "Готово — **студийный свет** и мягкие тени:",
      aspect: "1:1",
      resultCaption: "Флакон духов · студийный свет, мягкий градиент",
      resultMeta: "Формат 1:1",
      sample: {
        src: "/images/model-landings/seedream-5-0-pro/perfume-bottle.webp",
        alt: "Студийная съёмка гранёного стеклянного флакона духов с янтарной жидкостью на каменной поверхности — изображение, созданное Seedream 5.0 Pro в GIPITI",
        width: 1280,
        height: 1280,
      },
    },
    benefits: [
      {
        icon: "sparkles",
        title: "Фотореализм коммерческого уровня",
        text: "Seedream 5.0 Pro создавалась под сложные реалистичные сцены: корректные блики, честные тени и материалы, которые выглядят как настоящие.",
      },
      {
        icon: "wand",
        title: "Точное редактирование",
        text: "Скажите, что поменять — модель правит именно это и сохраняет остальной кадр: свет, цвет и детали не «уплывают» после каждой итерации.",
      },
      russianPromptBenefit,
      vpnBenefit,
    ],
    steps: buildImageSteps(
      "Seedream 5.0 Pro",
      "Чем точнее описан кадр — свет, материалы, ракурс — тем ближе результат к съёмке."
    ),
    audience: [
      {
        title: "Предметная съёмка",
        text: "Карточки товара и рекламные кадры без студии, фотографа и аренды света.",
        userMessage:
          "Керамические миски ручной работы на льняной салфетке, вид сверху, дневной свет",
        aiReply: "**Готово** · керамика на льне, вид сверху",
        sample: {
          src: "/images/model-landings/seedream-5-0-pro/ceramics.webp",
          alt: "Вид сверху: керамические миски ручной работы на льняной салфетке на светлом дубовом столе",
          width: 900,
          height: 900,
        },
      },
      {
        title: "Портреты и репортаж",
        text: "Живые кадры с людьми для сайта, презентации или статьи.",
        userMessage:
          "Портрет керамистки в мастерской, глина на руках, свет из окна слева",
        aiReply: "**Портрет** · мастерская, свет из окна",
        sample: {
          src: "/images/model-landings/seedream-5-0-pro/portrait-artist.webp",
          alt: "Портрет керамистки в мастерской: глина на руках, мягкий свет из окна слева",
          width: 900,
          height: 900,
        },
      },
      {
        title: "Макро и детали",
        text: "Сложные фактуры и мелкие детали крупным планом — металл, стекло, механика.",
        userMessage:
          "Макро механизма наручных часов, латунные шестерни, контровой свет",
        aiReply: "**Макро** · механизм часов, контровой свет",
        sample: {
          src: "/images/model-landings/seedream-5-0-pro/watch-macro.webp",
          alt: "Макросъёмка механизма наручных часов: стальные мосты и латунные шестерни на тёмном сланце",
          width: 900,
          height: 900,
        },
      },
    ],
    faq: [
      {
        question: "Что такое Seedream 5.0 Pro?",
        answer:
          "Seedream 5.0 Pro — старшая модель ByteDance для генерации изображений. Она рассчитана на сложные реалистичные сцены и точное редактирование: правки применяются адресно, а остальной кадр сохраняется. В GIPITI доступна без VPN и с оплатой российскими картами.",
      },
      {
        question: "Чем Pro отличается от Seedream 5.0 Lite?",
        answer:
          "Pro детальнее прорабатывает свет, материалы и мелкие элементы кадра и точнее выполняет правки. Lite быстрее и дешевле — её удобно брать для набросков и перебора идей, а удачный кадр повторить в Pro.",
      },
      {
        question: "Можно ли отредактировать своё изображение?",
        answer:
          "Да. Прикрепите картинку и опишите правку словами — модель изменит указанное и сохранит остальную часть кадра. Продолжайте уточнять в том же чате.",
      },
      ...sharedMediaFaq,
    ],
    otherModels: buildChips([
      {
        name: "Seedream 5.5",
        tag: "Изображения",
        slug: SEEDREAM_55_SLUG,
      },
      {
        name: "Seedream 5.0 Lite",
        tag: "Изображения",
        slug: SEEDREAM_LITE_SLUG,
      },
      { name: "Seedream 4.5", tag: "Изображения", slug: SEEDREAM_45_SLUG },
      { name: "Nano Banana", tag: "Изображения", slug: NANO_BANANA_SLUG },
      { name: "Seedance 2.5", tag: "Видео", slug: SEEDANCE_25_SLUG },
    ]),
  },
  {
    kind: "image",
    slug: SEEDREAM_LITE_SLUG,
    modelId: "seedream-5.0-lite",
    name: "Seedream 5.0 Lite",
    vendor: "ByteDance",
    accent: "blue",
    badge: "ByteDance · Быстро и недорого · Изображения",
    h1Top: "Seedream 5.0 Lite —",
    h1Gradient: "нейросеть ByteDance для картинок",
    sub: `Быстрая и недорогая модель ByteDance для изображений уже в GIPITI — точно понимает сложные описания и уверенно работает с русским промптом. Без VPN, с оплатой российскими картами. ${NEW_USER_BONUS_SHORT_RU}.`,
    metaTitle: "Seedream 5.0 Lite — генерация изображений ByteDance | GIPITI",
    metaDescription: `Seedream 5.0 Lite в GIPITI — быстрая и недорогая модель ByteDance для генерации изображений по описанию на русском. Без VPN, оплата российскими картами. ${NEW_USER_BONUS_SHORT_RU}.`,
    heroMedia: {
      userMessage:
        "Витрина пекарни утром: круассаны на подносе, пар от кофе, солнце сбоку, квадратный кадр",
      aiIntro: "Готово. Могу поменять свет, ракурс или состав кадра:",
      aspect: "1:1",
      resultCaption: "Витрина пекарни · круассаны, пар от кофе, боковой свет",
      resultMeta: "Формат 1:1",
      sample: {
        src: "/images/model-landings/seedream-5-0-lite/bakery.webp",
        alt: "Витрина пекарни утром: круассаны на подносе и чашка кофе с паром в боковом свете — изображение, созданное Seedream 5.0 Lite в GIPITI",
        width: 1280,
        height: 1280,
      },
    },
    benefits: [
      {
        icon: "sparkles",
        title: "Понимает сложные описания",
        text: "Несколько объектов, взаимное расположение, свет и настроение в одном запросе — Seedream 5.0 удерживает условия целиком.",
      },
      russianPromptBenefit,
      {
        icon: "ratio",
        title: "Восемь форматов кадра",
        text: "От квадрата до широкого 21:9 — подберите пропорции под баннер, карточку товара или сторис.",
      },
      vpnBenefit,
    ],
    steps: buildImageSteps("Seedream 5.0 Lite"),
    audience: [
      {
        title: "E-commerce и реклама",
        text: "Карточки товара и баннеры в нужном формате — быстро и в едином стиле.",
        userMessage:
          "Баннер для акции: корзина овощей на деревянном столе, светлая кухня",
        aiReply: "**Баннер** · корзина овощей на деревянном столе",
        sample: {
          src: "/images/model-landings/seedream-5-0-lite/vegetables.webp",
          alt: "Корзина свежих овощей на деревянном столе в светлой кухне",
          width: 900,
          height: 900,
        },
      },
      {
        title: "Контент-команды",
        text: "Иллюстрации к материалам, когда сцена сложнее, чем «просто картинка».",
        userMessage:
          "Кадр: девушка у окна поезда с книгой, вечерний свет, вид сбоку",
        aiReply: "**Кадр** · девушка у окна поезда, вечерний свет",
        sample: {
          src: "/images/model-landings/seedream-5-0-lite/girl-with-a-book.webp",
          alt: "Девушка читает книгу у окна поезда на фоне закатного неба",
          width: 900,
          height: 900,
        },
      },
      {
        title: "Дизайнеры",
        text: "Референсы и фоны под макет — с точной композицией и пропорциями.",
        userMessage: "Абстрактный фон: волны в синих тонах, мягкое размытие",
        aiReply: "**Фон** · синие волны, мягкое размытие",
        sample: {
          src: "/images/model-landings/seedream-5-0-lite/waves.webp",
          alt: "Абстрактный фон: плавные синие волны с мягким размытием",
          width: 900,
          height: 900,
        },
      },
    ],
    faq: [
      {
        question: "Что такое Seedream 5.0 Lite?",
        answer:
          "Seedream 5.0 Lite — быстрая и недорогая модель ByteDance для генерации изображений: точно понимает сложные промпты и аккуратно собирает сцену. В GIPITI она доступна без VPN и с оплатой российскими картами.",
      },
      {
        question: "Чем Seedream 5.0 Lite отличается от Seedream 4.5?",
        answer:
          "5.0 Lite — новее и лучше понимает сложные описания. 4.5 сильнее в редактировании готовых изображений с сохранением деталей, света и цвета. Обе модели входят в одну подписку.",
      },
      {
        question: "Подойдёт ли модель для рекламных материалов?",
        answer:
          "Да — восемь форматов кадра закрывают баннеры, карточки товара и сторис. Перед публикацией стоит проверить кадр на артефакты: генеративные модели иногда ошибаются в мелких деталях.",
      },
      ...sharedMediaFaq,
    ],
    otherModels: buildChips([
      {
        name: "Seedream 5.0 Pro",
        tag: "Изображения",
        slug: SEEDREAM_PRO_SLUG,
      },
      { name: "Seedream 4.5", tag: "Изображения", slug: SEEDREAM_45_SLUG },
      { name: "Nano Banana", tag: "Изображения", slug: NANO_BANANA_SLUG },
      { name: "Flux 2 Max", tag: "Изображения", slug: FLUX_SLUG },
    ]),
  },
  {
    kind: "image",
    slug: SEEDREAM_45_SLUG,
    modelId: "seedream-4.5",
    name: "Seedream 4.5",
    vendor: "ByteDance",
    accent: "sky",
    badge: "ByteDance · Точное редактирование · Изображения",
    h1Top: "Seedream 4.5 —",
    h1Gradient: "редактирование изображений по описанию",
    sub: `Модель ByteDance уже в GIPITI — правит готовые изображения, сохраняя детали, свет и цвет, и уверенно работает с текстом на картинке. Без VPN, с оплатой российскими картами. ${NEW_USER_BONUS_SHORT_RU}.`,
    metaTitle: "Seedream 4.5 — редактирование изображений нейросетью | GIPITI",
    metaDescription:
      "Seedream 4.5 в GIPITI — генерация и точное редактирование изображений с сохранением деталей, света и цвета. Без VPN, на русском, оплата российскими картами.",
    heroMedia: {
      userMessage:
        "Замени фон на этом фото на светлую студию, но оставь свет и тени как есть 📎 photo.jpg",
      aiIntro: "Фон заменён, свет и тени сохранены:",
      aspect: "1:1",
      resultCaption: "Фон заменён · светлая студия, исходный свет",
      resultMeta: "Формат 1:1 · исходные детали сохранены",
      sample: {
        src: "/images/model-landings/seedream-4-5/white-studio-portrait.webp",
        alt: "Портрет мужчины в свитере на светлом студийном фоне после замены фона — изображение, созданное Seedream 4.5 в GIPITI",
        width: 1280,
        height: 1280,
      },
    },
    benefits: [
      {
        icon: "wand",
        title: "Правит, не ломая кадр",
        text: "Замена фона, объекта или цвета — Seedream 4.5 аккуратно сохраняет детали, свет и тени исходного изображения.",
      },
      {
        icon: "pen",
        title: "Работает с текстом на картинке",
        text: "Надписи на упаковке, вывесках и постерах модель воспроизводит заметно аккуратнее большинства конкурентов.",
      },
      historyBenefit,
      vpnBenefit,
    ],
    steps: buildImageSteps(
      "Seedream 4.5",
      "Прикрепите картинку и опишите правку — или просто опишите кадр с нуля."
    ),
    audience: [
      {
        title: "Интернет-магазины",
        text: "Единый фон и свет для всех карточек товара — из разнородных фото.",
        userMessage: "Поставь все эти товары на одинаковый белый фон 📎 📎 📎",
        aiReply: "**Фон унифицирован** · белая подложка, мягкая тень",
        sample: {
          src: "/images/model-landings/seedream-4-5/white-background.webp",
          alt: "Набор разноцветных кружек на общем белом фоне с мягкой тенью",
          width: 900,
          height: 900,
        },
      },
      {
        title: "Бренды и упаковка",
        text: "Макеты с надписями: этикетки, вывески и постеры с читаемым текстом.",
        userMessage:
          "Замени надпись на упаковке на «Новый вкус» и оставь дизайн 📎",
        aiReply: "**Надпись заменена** · дизайн упаковки сохранён",
        sample: {
          src: "/images/model-landings/seedream-4-5/new-flavour.webp",
          alt: "Упаковка чая с растительным узором и заменённой надписью «Новый вкус»",
          width: 900,
          height: 900,
        },
      },
      {
        title: "Фотографы и ретушёры",
        text: "Быстрая ретушь по словам: убрать лишнее, поправить фон, сменить сезон.",
        userMessage:
          "Убери провода из кадра и оставь всё остальное как есть 📎",
        aiReply: "**Провода убраны** · стол и свет не тронуты",
        sample: {
          src: "/images/model-landings/seedream-4-5/cables.webp",
          alt: "Рабочий стол с монитором и лампой у окна после удаления проводов из кадра",
          width: 900,
          height: 900,
        },
      },
    ],
    faq: [
      {
        question: "Что такое Seedream 4.5?",
        answer:
          "Seedream 4.5 — модель ByteDance для генерации и редактирования изображений с сохранением деталей, света и цвета. В GIPITI она доступна без VPN, с интерфейсом на русском языке и оплатой российскими картами.",
      },
      {
        question: "Как отредактировать своё изображение?",
        answer:
          "Прикрепите картинку прямо в чат и опишите правку словами — что заменить, убрать или изменить. Модель вернёт новую версию, исходник останется в истории диалога.",
      },
      {
        question: "Чем Seedream 4.5 отличается от 5.0 Lite?",
        answer:
          "4.5 сильнее в редактировании готовых изображений и работе с текстом на картинке. 5.0 Lite новее и точнее понимает сложные описания при генерации с нуля. Обе модели входят в одну подписку.",
      },
      ...sharedMediaFaq,
    ],
    otherModels: buildChips([
      {
        name: "Seedream 5.0 Pro",
        tag: "Изображения",
        slug: SEEDREAM_PRO_SLUG,
      },
      {
        name: "Seedream 5.0 Lite",
        tag: "Изображения",
        slug: SEEDREAM_LITE_SLUG,
      },
      { name: "Nano Banana", tag: "Изображения", slug: NANO_BANANA_SLUG },
      {
        name: "GPT Image 2.5 Sunburst",
        tag: "Изображения",
        slug: GPT_IMAGE_25_SUNBURST_SLUG,
      },
    ]),
  },
];
