/**
 * Landings for the Microsoft AI image models: MAI-Image 2.7 and 2.7 Flash
 * (aspect picker: 1:1 default, 16:9, 9:16; edits honour it; no transparent
 * background or 2048 px in the app) and MAI-Image 2.6 and 2.6 Flash.
 *
 * Note: neither 2.6 model has a format setting in GIPITI, and the shape words in a
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
  FLUX_3_IMAGE_KLEIN_SLUG,
  GPT_IMAGE_25_FLARE_SLUG,
  GPT_IMAGE_25_SUNBURST_SLUG,
  GPT_IMAGE_26_SUNBURST_SLUG,
  MAI_IMAGE_26_FLASH_SLUG,
  MAI_IMAGE_26_SLUG,
  MAI_IMAGE_27_FLASH_SLUG,
  MAI_IMAGE_27_SLUG,
  NANO_BANANA_LITE_SLUG,
  NANO_BANANA_PRO_SLUG,
  RECRAFT_FLASH_SLUG,
  SEEDREAM_LITE_SLUG,
  SEEDREAM_PRO_SLUG,
  vpnBenefit,
} from "./shared";
import type { ModelLanding } from "./types";

export const microsoftImageLandings: ModelLanding[] = [
  {
    kind: "image",
    slug: MAI_IMAGE_27_SLUG,
    modelId: "mai-image-2.7",
    name: "MAI-Image 2.7",
    vendor: "Microsoft",
    accent: "blue",
    badge: "Microsoft AI · Качество и правки · Изображения",
    h1Top: "MAI-Image 2.7 —",
    h1Gradient: "новая нейросеть Microsoft для картинок",
    sub: "Диффузионная модель Microsoft AI для генерации и точного редактирования изображений уже в GIPITI — фотореалистичные сцены по описанию на русском и правки загруженных картинок. Три формата кадра на выбор. Без VPN, с оплатой российскими картами. Дарим 200 ₽ каждому новому пользователю.",
    ctaMain: "Попробовать MAI-Image 2.7",
    metaTitle: "MAI-Image 2.7 — нейросеть Microsoft для изображений | GIPITI",
    metaDescription:
      "MAI-Image 2.7 в GIPITI — генерация изображений и точное редактирование от Microsoft AI, три формата кадра. Промпт на русском, без VPN, оплата картами РФ.",
    heroMedia: {
      userMessage:
        "Оранжерея-кафе утром: круглые мраморные столики, плетёные стулья, подвесные папоротники и монстеры, стеклянная крыша, тёплый мягкий свет, без людей, квадратный кадр",
      aiIntro: "Готово. Могу сделать кадр шире или вертикальным:",
      aspect: "1:1",
      resultCaption: "Оранжерея-кафе · утренний свет",
      resultMeta: "Фотореализм · формат 1:1",
      sample: {
        src: "/images/model-landings/mai-image-2-7/greenhouse-cafe.webp",
        alt: "Солнечная оранжерея-кафе: мраморные столики, плетёные стулья и подвесные папоротники под стеклянной крышей — изображение, созданное MAI-Image 2.7 в GIPITI",
        width: 1024,
        height: 1024,
      },
    },
    benefits: [
      {
        icon: "image",
        title: "Фотореалистичные сцены",
        text: "Пейзажи, интерьеры, портреты и архитектурные сцены по описанию на русском — от «закат над морем» до подробного абзаца с деталями.",
      },
      {
        icon: "wand",
        title: "Точные правки загруженных картинок",
        text: "Прикрепите изображение и опишите изменение: перекрасить фасады, заменить фон или убрать лишнее. Остальной кадр модель старается сохранить.",
      },
      {
        icon: "ratio",
        title: "Квадрат, 16:9 и 9:16",
        text: "По умолчанию кадр квадратный; для обложки или сторис выберите широкий или вертикальный. Формат учитывается и при правках.",
      },
      vpnBenefit,
    ],
    steps: buildImageSteps(
      "MAI-Image 2.7",
      "Опишите сцену или прикрепите картинку и напишите правку, затем выберите формат кадра."
    ),
    audience: [
      {
        title: "Дизайнеры интерьеров",
        text: "Покажите клиенту другой цвет фасадов или отделки на том же кадре кухни.",
        userMessage:
          "Перекрась белые фасады кухни в глубокий тёмно-синий, остальное не трогай 📎 kitchen.jpg",
        aiReply: "**Правка** · фасады стали тёмно-синими",
        sample: {
          src: "/images/model-landings/mai-image-2-7/navy-kitchen.webp",
          alt: "Светлая кухня с тёмно-синими фасадами, деревянной столешницей и миской зелёных яблок на острове",
          width: 900,
          height: 900,
        },
      },
      {
        title: "Журналы и сайты",
        text: "Портреты и репортажные сцены для публикаций, когда съёмка не укладывается в сроки.",
        userMessage:
          "Портрет пожилой садовницы в соломенной шляпе среди подсолнухов, тёплый вечерний свет, мягкая глубина резкости",
        aiReply: "**Портрет** · садовница среди подсолнухов",
        sample: {
          src: "/images/model-landings/mai-image-2-7/gardener.webp",
          alt: "Улыбающаяся пожилая женщина в соломенной шляпе и джинсовом фартуке держит подсолнухи в вечернем саду",
          width: 900,
          height: 900,
        },
      },
      {
        title: "Архитекторы и застройщики",
        text: "Атмосферные визуализации для презентаций: свет, материалы и окружение до начала проекта.",
        userMessage:
          "Современный деревянный дом с панорамными окнами в сосновом лесу, золотой час, туман между деревьями",
        aiReply: "**Визуализация** · дом в сосновом лесу на рассвете",
        sample: {
          src: "/images/model-landings/mai-image-2-7/forest-house.webp",
          alt: "Современный деревянный дом с большими окнами и террасой в сосновом лесу, в тумане над озером встаёт солнце",
          width: 900,
          height: 900,
        },
      },
    ],
    faq: [
      {
        question: "Что такое MAI-Image 2.7?",
        answer:
          "MAI-Image 2.7 — диффузионная модель Microsoft AI для создания изображений по тексту и точного редактирования. В GIPITI она работает без VPN, с промптом на русском и оплатой российскими картами.",
      },
      {
        question: "Чем MAI-Image 2.7 отличается от версии Flash?",
        answer:
          "Возможности генерации и правок у них одинаковые. Flash быстрее и заметно дешевле — её удобно брать для черновиков. Если нужен финальный кадр, удачную идею из Flash можно повторить на MAI-Image 2.7 и сравнить результаты.",
      },
      {
        question: "Какие форматы кадра доступны?",
        answer:
          "Три: квадрат 1:1 (он стоит по умолчанию), широкий 16:9 и вертикальный 9:16. Формат выбирается перед генерацией и действует в том числе на правки.",
      },
      {
        question: "Можно ли выбрать разрешение или получить прозрачный фон?",
        answer:
          "Нет. В GIPITI у модели настраивается только формат кадра; разрешение и прозрачный фон недоступны, изображение приходит с обычным фоном.",
      },
      ...sharedMediaFaq,
    ],
    otherModels: buildChips([
      {
        name: "MAI-Image 2.7 Flash",
        tag: "Изображения",
        slug: MAI_IMAGE_27_FLASH_SLUG,
      },
      { name: "MAI-Image 2.6", tag: "Изображения", slug: MAI_IMAGE_26_SLUG },
      {
        name: "GPT Image 2.6 Sunburst",
        tag: "Изображения",
        slug: GPT_IMAGE_26_SUNBURST_SLUG,
      },
      {
        name: "Nano Banana Pro",
        tag: "Изображения",
        slug: NANO_BANANA_PRO_SLUG,
      },
    ]),
  },
  {
    kind: "image",
    slug: MAI_IMAGE_27_FLASH_SLUG,
    modelId: "mai-image-2.7-flash",
    name: "MAI-Image 2.7 Flash",
    vendor: "Microsoft",
    accent: "sky",
    badge: "Microsoft AI · Быстро и недорого · Изображения",
    h1Top: "MAI-Image 2.7 Flash —",
    h1Gradient: "быстрая и недорогая модель Microsoft",
    sub: "Облегчённая версия MAI-Image 2.7 уже в GIPITI — те же генерация и правки по описанию на русском, но быстрее и дешевле. Удобно, когда идей много и каждую хочется увидеть. Квадрат, 16:9 или 9:16. Без VPN, с оплатой российскими картами. Дарим 200 ₽ каждому новому пользователю.",
    ctaMain: "Попробовать MAI-Image 2.7 Flash",
    metaTitle: "MAI-Image 2.7 Flash — быстрая нейросеть Microsoft | GIPITI",
    metaDescription:
      "MAI-Image 2.7 Flash в GIPITI — быстрая и недорогая генерация и правка изображений от Microsoft AI, три формата кадра. Промпт на русском, без VPN, оплата картами РФ.",
    heroMedia: {
      userMessage:
        "Уютный домик на дереве в старом дубе на закате: тёплые окна, верёвочный мост, объёмная иллюстрация, квадратный кадр",
      aiIntro: "Готово. Сделать ещё вариант — например, зимой или ночью?",
      aspect: "1:1",
      resultCaption: "Домик на дубе · закат, верёвочный мост",
      resultMeta: "3D-иллюстрация · формат 1:1",
      sample: {
        src: "/images/model-landings/mai-image-2-7-flash/treehouse.webp",
        alt: "Сказочный домик на огромном дубе с тёплыми окнами и верёвочным мостом на фоне заката над лесом и озером — изображение, созданное MAI-Image 2.7 Flash в GIPITI",
        width: 1024,
        height: 1024,
      },
    },
    benefits: [
      {
        icon: "zap",
        title: "Быстрее и дешевле старшей версии",
        text: "Flash — облегчённый вариант MAI-Image 2.7: картинка готовится быстрее, а стоит меньше, поэтому десяток вариантов подряд обходится недорого.",
      },
      {
        icon: "layers",
        title: "Генерация и правки в одной модели",
        text: "Рисует по описанию и правит загруженные изображения, как и MAI-Image 2.7: набор возможностей у двух версий совпадает.",
      },
      {
        icon: "ratio",
        title: "Три формата кадра",
        text: "Квадрат по умолчанию, широкий 16:9 под обложки и вертикальный 9:16 под сторис — выбираете перед запуском.",
      },
      vpnBenefit,
    ],
    steps: buildImageSteps(
      "MAI-Image 2.7 Flash",
      "Коротко опишите идею и выберите формат — детали можно уточнить следующим сообщением."
    ),
    audience: [
      {
        title: "Свадьбы и мероприятия",
        text: "Заготовки приглашений и открыток: оформление есть, а текст вы добавите сами.",
        userMessage:
          "Акварельная рамка из пионов и листьев эвкалипта вокруг пустого кремового поля, шаблон приглашения, без текста",
        aiReply: "**Шаблон** · рамка из пионов, пустое поле для текста",
        sample: {
          src: "/images/model-landings/mai-image-2-7-flash/wedding-border.webp",
          alt: "Акварельная рамка из розовых и белых пионов и веток эвкалипта вокруг пустого кремового поля с тонкой золотой линией",
          width: 900,
          height: 900,
        },
      },
      {
        title: "Геймдизайн и концепт-арт",
        text: "Быстрые наброски локаций и настроения, пока команда ещё выбирает направление.",
        userMessage:
          "Концепт-арт: город на скалах в пустыне в полдень, белые башни с террасами, мосты между скалами, дирижабли в синем небе, без надписей",
        aiReply: "**Концепт** · белый город в скалах пустыни",
        sample: {
          src: "/images/model-landings/mai-image-2-7-flash/desert-cliff-city.webp",
          alt: "Белый футуристический город на скалах пустыни: башни с террасами, мосты между скалами, дирижабли в синем небе",
          width: 900,
          height: 900,
        },
      },
      {
        title: "Детские книги и обучение",
        text: "Яркие иллюстрации к историям и карточкам: можно быстро подобрать героя и стиль.",
        userMessage:
          "Плоская яркая иллюстрация в стиле детской книги: дружелюбный робот-садовник поливает цветы из маленькой лейки",
        aiReply: "**Иллюстрация** · робот-садовник с лейкой",
        sample: {
          src: "/images/model-landings/mai-image-2-7-flash/robot-gardener.webp",
          alt: "Весёлый маленький робот в соломенной шляпе поливает яркие цветы из лейки в саду",
          width: 900,
          height: 900,
        },
      },
    ],
    faq: [
      {
        question: "Что такое MAI-Image 2.7 Flash?",
        answer:
          "MAI-Image 2.7 Flash — более быстрая и дешёвая версия модели Microsoft AI для создания и правки изображений. В GIPITI она доступна без VPN, с промптом на русском и оплатой российскими картами.",
      },
      {
        question: "Когда выбрать MAI-Image 2.7, а не Flash?",
        answer:
          "Когда хотите сравнить: одна идея на MAI-Image 2.7 и на Flash может выглядеть по-разному. Для серии черновиков обычно хватает Flash: возможности у двух версий одинаковые, различаются скорость и цена.",
      },
      {
        question: "Можно ли сделать вертикальную картинку для сторис?",
        answer:
          "Да. Перед генерацией выберите формат 9:16; кроме него есть квадрат 1:1 (по умолчанию) и широкий 16:9.",
      },
      {
        question: "Редактирует ли Flash загруженные изображения?",
        answer:
          "Да. Прикрепите картинку и опишите правку словами — заменить предмет, поменять цвет, убрать лишнее. Выбранный формат кадра учитывается и в правках.",
      },
      ...sharedMediaFaq,
    ],
    otherModels: buildChips([
      { name: "MAI-Image 2.7", tag: "Изображения", slug: MAI_IMAGE_27_SLUG },
      {
        name: "MAI-Image 2.6 Flash",
        tag: "Изображения",
        slug: MAI_IMAGE_26_FLASH_SLUG,
      },
      {
        name: "Flux 3 Image Klein",
        tag: "Изображения",
        slug: FLUX_3_IMAGE_KLEIN_SLUG,
      },
      {
        name: "Recraft V4.1 Flash",
        tag: "Изображения",
        slug: RECRAFT_FLASH_SLUG,
      },
    ]),
  },
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
          "Нет: настроек формата и разрешения у MAI-Image 2.6 нет, и сейчас она отдаёт квадратные изображения 1024 × 1024, даже если попросить широкий или вертикальный кадр. Если нужен выбор формата, попробуйте MAI-Image 2.7: там есть квадрат, 16:9 и 9:16. Для 4K выберите Nano Banana Pro — там соотношение сторон и качество задаются перед генерацией.",
      },
      ...sharedMediaFaq,
    ],
    otherModels: buildChips([
      {
        name: "MAI-Image 2.7",
        tag: "Изображения",
        slug: MAI_IMAGE_27_SLUG,
      },
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
    metaTitle:
      "MAI-Image 2.6 Flash — предыдущая версия Flash от Microsoft | GIPITI",
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
        question: "Есть ли более новая версия Flash?",
        answer:
          "Да, MAI-Image 2.7 Flash — более новая версия, в которой есть выбор формата кадра: квадрат, 16:9 или 9:16. У MAI-Image 2.6 Flash такого выбора нет.",
      },
      {
        question: "Можно ли редактировать свои изображения?",
        answer:
          "Да. Прикрепите картинку в чат и опишите правку словами: заменить предмет, поправить надпись, убрать лишнее.",
      },
      ...sharedMediaFaq,
    ],
    otherModels: buildChips([
      {
        name: "MAI-Image 2.7 Flash",
        tag: "Изображения",
        slug: MAI_IMAGE_27_FLASH_SLUG,
      },
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
