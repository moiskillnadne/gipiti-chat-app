# Image model landings — October 2026 (drafts)

Draft Russian landing copy for the four image models added in the October 2026
batch (see `docs/plans/2026-10-29-add-october-2026-models-and-fix-broken-gateway-ids.md`).
The models are already in the picker; their landings and catalog cards are
**not wired yet** on purpose.

## Before wiring a landing

`lib/marketing/__tests__/model-landings.test.ts` fails an image landing unless:

- the hero and **every** audience tile carry a `sample`;
- each `sample.src` matches `/images/model-landings/<slug>/<name>.webp` and the
  file exists under `public/images/model-landings/<slug>/`;
- no render is reused across landings.

So, for each model:

1. Generate every render below **with that exact model** in GIPITI (or via the
   gateway id). The captions describe what was asked, so a render from another
   model is a false claim. Use the English prompt as written; for the edit tiles,
   either run a real edit on a source photo or generate the finished scene with
   the prompt given.
2. Convert to WebP and save as `public/images/model-landings/<slug>/<name>.webp`.
   Neighbours use about 1280 px on the long side for the hero and about 900 px
   for tiles.
3. Fill in the real `width` / `height` (they are `0` placeholders below). The
   hero `aspect` must match the render's proportions — for Flux 3 Image and the
   MAI models (no format setting, the model picks the ratio) change `aspect` to
   whatever came out (`16:9`, `3:2`, `1:1` or `9:16`).
4. Paste the landing into the target module, swap the copied shared blocks for
   imports (see "Shared blocks" below), add the slug const to the Image landings
   block of `lib/marketing/model-landings/shared.ts`, add the module to
   `index.ts`, and add the catalog card to `lib/marketing/models-catalog.ts`
   (catalog and landings must stay in sync — the test checks every catalog model
   has a landing).

Every landing uses **hero + 3 audience tiles** (4 renders), matching every
existing landing and the 3-column audience grid in
`components/models/landing/model-landing-audience.tsx`.

### Shared blocks

The JSON below expands shared helpers so it reads as final copy. When wiring:

- `steps` → `buildImageSteps("<name>", "<hint>")` — the hint is the third step's `text`;
- the `shield` benefit → `vpnBenefit`; the "Правки в том же чате" benefit → `chatIterationBenefit`;
- the last three FAQ items (VPN, price, prompt language) → `...sharedMediaFaq`;
- `otherModels` → `buildChips([...])` with the slug constants.

Chips link only to landings that already exist. Once two or more of these
landings are live, cross-link them (e.g. MAI-Image 2.6 ↔ 2.6 Flash, Nano
Banana 2.1 ↔ Nano Banana).

### Claims the copy relies on (from the research facts table)

- Nano Banana 2.1: Google model, GA 6 Oct 2026, successor to Nano Banana 2;
  better generation and editing than earlier Nano Banana models, product scene
  placement, more factual depiction of real-world subjects. In GIPITI: 1K/2K/4K
  and ten aspect ratios (`GOOGLE_IMAGE_GEN_CONFIG`), image input for edits.
- Flux 3 Image: BFL flagship, launched 1 Oct 2026 (on the gateway 5 Oct);
  text-to-image and editing in one model; local edits without manual masks. In
  GIPITI: no format/resolution setting (no `imageGenConfig`), single image input.
  Native 4K and up to 10 references are **not** claimed — GIPITI exposes neither.
- MAI-Image 2.6 / 2.6 Flash: Microsoft AI, GA 13 Oct 2026; generation and
  precise edits (objects, text, layout, cleanup); dynamic aspect ratio derived
  from prompt and inputs; output up to about 1.5K. Flash is the faster, cheaper
  sibling with the same feature set; its image-output tokens cost about half
  ($19 vs $38 per 1M). Multi-reference editing and web grounding are **not**
  claimed — the dedicated image adapter sends a single image.
- No per-image prices are quoted anywhere (sources conflict).

Open questions to settle before wiring:

- ru.json names: `nanoBanana21.name` is "Gemini Nano banana 2.1" (lower-case
  "b"); the landing uses "Nano Banana 2.1". `flux3Image.name` is "FLUX 3 Image";
  the landing uses "Flux 3 Image" to match "Flux 2 Max" / "Flux 3 Video".
  Align the picker names with the landing names (or the reverse) so step 2
  ("Выберите …") matches what the user sees.
- Nano Banana 2.1 is described as the successor of "Nano Banana 2"; in GIPITI
  the previous model (Gemini 3.1 Flash Image) is labelled just "Nano Banana".
  The FAQ compares against the GIPITI names.
- MAI: confirm after deploy that a prompt asking for "wide" or "vertical"
  actually changes the ratio (the copy promises it follows the description).

---

## 1. Nano Banana 2.1

- Slug: `nano-banana-2-1` → `NANO_BANANA_21_SLUG`
- Model id: `nano-banana-2.1` (gateway `google/gemini-nano-banana-2.1`)
- Target module: `lib/marketing/model-landings/image-google.ts`

### Landing

```json
{
  "kind": "image",
  "slug": "nano-banana-2-1",
  "modelId": "nano-banana-2.1",
  "name": "Nano Banana 2.1",
  "vendor": "Google",
  "accent": "rose",
  "badge": "Google · Новое поколение · Изображения",
  "h1Top": "Nano Banana 2.1 —",
  "h1Gradient": "новая нейросеть Google для картинок",
  "sub": "Новое поколение Nano Banana уже в GIPITI — рисует по описанию на русском, переносит товар в другую сцену и правит готовые изображения в качестве до 4K. Без VPN, с оплатой российскими картами. Дарим 200 ₽ каждому новому пользователю.",
  "ctaMain": "Попробовать Nano Banana 2.1",
  "metaTitle": "Nano Banana 2.1 — нейросеть Google для картинок | GIPITI",
  "metaDescription": "Nano Banana 2.1 в GIPITI — новая модель Google: генерация и редактирование изображений на русском в 1K, 2K и 4K, десять форматов. Без VPN, оплата картами РФ.",
  "heroMedia": {
    "userMessage": "Нарисуй мастерскую керамиста: гончарный круг, полки с вазами, солнечные лучи сквозь пыль, 16:9",
    "aiIntro": "Готово — **2K, 16:9**. Скажите, что поправить:",
    "aspect": "16:9",
    "resultCaption": "Мастерская керамиста · гончарный круг, лучи солнца",
    "resultMeta": "2K · 16:9",
    "sample": {
      "src": "/images/model-landings/nano-banana-2-1/pottery-studio.webp",
      "alt": "Мастерская керамиста с гончарным кругом и полками ваз в солнечных лучах — изображение, созданное Nano Banana 2.1 в GIPITI",
      "width": 0,
      "height": 0
    }
  },
  "benefits": [
    {
      "icon": "sparkles",
      "title": "Следующее поколение Nano Banana",
      "text": "Google улучшила и генерацию, и редактирование по сравнению с прошлыми Nano Banana: модель увереннее ставит товар в новую сцену и правдоподобнее изображает реальные места и предметы."
    },
    {
      "icon": "wand",
      "title": "Правки по вашей картинке",
      "text": "Прикрепите изображение и напишите, что изменить: заменить объект, сменить фон, перенести продукт в интерьер. Модель поправит то, о чём вы попросили."
    },
    {
      "icon": "ratio",
      "title": "1K, 2K или 4K и десять форматов",
      "text": "Качество и соотношение сторон выбираются перед генерацией: квадрат для маркетплейса, 9:16 для сторис, 21:9 для широкого баннера."
    },
    {
      "icon": "shield",
      "title": "Без VPN и зарубежных карт",
      "text": "Работает из России без ограничений. Оплата картами МИР, Visa, MasterCard или через СБП — в рублях."
    }
  ],
  "steps": [
    { "title": "Зарегистрируйтесь", "text": "Аккаунт за 30 секунд — нужен только email. Дарим 200 ₽ каждому новому пользователю." },
    { "title": "Выберите Nano Banana 2.1", "text": "Переключитесь на модель в списке — в один клик, как и на любую из 30+." },
    { "title": "Опишите картинку", "text": "Что должно быть в кадре — или прикрепите изображение и скажите, что в нём поменять." },
    { "title": "Заберите результат", "text": "Изображение появится прямо в чате — скачайте его или попросите правку." }
  ],
  "audience": [
    {
      "title": "Интернет-магазины",
      "text": "Товар в живой обстановке вместо белого фона — для карточек, баннеров и рассылок.",
      "userMessage": "Поставь этот рюкзак на камень у горного озера, утренний туман 📎 backpack.jpg",
      "aiReply": "**Товар в новой сцене** · рюкзак у горного озера",
      "sample": {
        "src": "/images/model-landings/nano-banana-2-1/backpack-lake.webp",
        "alt": "Туристический рюкзак на камне у горного озера в утреннем тумане",
        "width": 0,
        "height": 0
      }
    },
    {
      "title": "Маркетологи и SMM",
      "text": "Обложки постов и креативы под сезонные акции — в нужном формате с первого раза.",
      "userMessage": "Обложка поста про осеннее меню кофейни: латте с корицей, кленовые листья, тёплый свет, 16:9",
      "aiReply": "**Обложка 16:9** · латте и кленовые листья",
      "sample": {
        "src": "/images/model-landings/nano-banana-2-1/autumn-latte.webp",
        "alt": "Чашка латте с корицей среди осенних кленовых листьев в тёплом свете",
        "width": 0,
        "height": 0
      }
    },
    {
      "title": "Редакции и блогеры",
      "text": "Иллюстрации к материалам о реальных местах — без поиска по стокам и прав на фото.",
      "userMessage": "Иллюстрация к статье о Байкале зимой: прозрачный лёд с трещинами, вдали горы, ясный полдень",
      "aiReply": "**Байкал зимой** · прозрачный лёд и горы",
      "sample": {
        "src": "/images/model-landings/nano-banana-2-1/baikal-ice.webp",
        "alt": "Прозрачный лёд Байкала с трещинами и горы на горизонте в ясный зимний день",
        "width": 0,
        "height": 0
      }
    }
  ],
  "faq": [
    {
      "question": "Что такое Nano Banana 2.1?",
      "answer": "Nano Banana 2.1 — модель Google для генерации и редактирования изображений, вышедшая в октябре 2026 года как преемник Nano Banana 2. В GIPITI она доступна без VPN, с промптом на русском и оплатой российскими картами."
    },
    {
      "question": "Чем Nano Banana 2.1 отличается от Nano Banana и Nano Banana Pro?",
      "answer": "2.1 — самое новое поколение: Google улучшила генерацию и правки, особенно размещение товара в сцене и изображение реальных объектов. Nano Banana Pro по-прежнему хороша для сложных описаний и текста на картинке, а классическая Nano Banana — проверенный вариант для повседневных задач. Все три модели есть в GIPITI."
    },
    {
      "question": "В каком качестве и формате можно получить картинку?",
      "answer": "1K, 2K или 4K — качество выбирается в настройках чата перед генерацией. Там же одно из десяти соотношений сторон: от квадрата до 21:9."
    },
    {
      "question": "Нужен ли VPN или зарубежная карта?",
      "answer": "Нет. GIPITI работает из России без ограничений, оплата — картами МИР, Visa, MasterCard или через СБП."
    },
    {
      "question": "Сколько это стоит?",
      "answer": "Запросы оплачиваются с баланса. Подписка 999 ₽/мес включает 999 ₽ на баланс каждый месяц, а каждому новому пользователю мы дарим 200 ₽ — хватит, чтобы попробовать."
    },
    {
      "question": "Нужно ли писать промпт на английском?",
      "answer": "Нет, описывайте задачу на русском. Если результат вышел не таким, добавьте деталей: что в кадре, стиль, ракурс, свет и настроение — это влияет сильнее, чем язык запроса."
    }
  ],
  "otherModels": [
    { "name": "Nano Banana Pro", "tag": "Изображения", "href": "/models/nano-banana-pro" },
    { "name": "Nano Banana", "tag": "Изображения", "href": "/models/nano-banana" },
    { "name": "GPT Image 2.5 Sunburst", "tag": "Изображения", "href": "/models/gpt-image-2-5-sunburst" },
    { "name": "Veo 3.1", "tag": "Видео", "href": "/models/veo-3-1" }
  ]
}
```

### Renders

Generate with **Nano Banana 2.1**, quality 2K, aspect 16:9 for all four (neighbour
Nano Banana tiles are 16:9).

| File | Aspect | Prompt |
|---|---|---|
| `pottery-studio.webp` (hero) | 16:9 | A cozy ceramics studio: a potter's wheel with a half-thrown clay vase in the foreground, wooden shelves full of glazed vases and bowls, warm sunbeams slanting through a dusty window, visible dust in the light, photorealistic, shallow depth of field. |
| `backpack-lake.webp` | 16:9 | Product photo: a teal hiking backpack standing upright on a mossy boulder at the edge of a calm alpine lake, soft morning mist over the water, pine forest and mountains in the background, natural light, photorealistic, crisp product detail. (Or run as an edit: "place this backpack on a rock by a mountain lake, morning mist" on a studio packshot.) |
| `autumn-latte.webp` | 16:9 | Social media cover: a ceramic cup of latte with cinnamon latte art on a rustic wooden table, scattered red and orange maple leaves, a cinnamon stick, warm golden afternoon light, cozy cafe mood, no text, photorealistic. |
| `baikal-ice.webp` | 16:9 | Lake Baikal in winter: thick crystal-clear blue ice with deep white cracks in the foreground, snow-dusted mountains on the far shore, clear blue sky, bright midday sun, wide-angle landscape photograph, photorealistic. |

### Catalog card

```json
{
  "modelId": "nano-banana-2.1",
  "name": "Nano Banana 2.1",
  "vendor": "Google",
  "provider": "google",
  "category": "images",
  "description": "Новое поколение Nano Banana: генерация и точечное редактирование изображений в 1K, 2K и 4K.",
  "tag": "Новинка",
  "hue": 90
}
```

---

## 2. Flux 3 Image

- Slug: `flux-3-image` → `FLUX_3_IMAGE_SLUG`
- Model id: `flux-3-image` (gateway `bfl/flux-3-image`)
- Target module: `lib/marketing/model-landings/image-bfl.ts`

### Landing

```json
{
  "kind": "image",
  "slug": "flux-3-image",
  "modelId": "flux-3-image",
  "name": "Flux 3 Image",
  "vendor": "Black Forest Labs",
  "accent": "violet",
  "badge": "Black Forest Labs · Новый флагман · Изображения",
  "h1Top": "Flux 3 Image —",
  "h1Gradient": "генерация и правки в одной модели",
  "sub": "Новый флагман Black Forest Labs уже в GIPITI — рисует по описанию на русском и правит готовые изображения той же моделью, без ручных масок. Без VPN, с оплатой российскими картами. Дарим 200 ₽ каждому новому пользователю.",
  "ctaMain": "Попробовать Flux 3 Image",
  "metaTitle": "Flux 3 Image — нейросеть для картинок от BFL | GIPITI",
  "metaDescription": "Flux 3 Image в GIPITI — флагман Black Forest Labs: генерация изображений и точечные правки в одной модели, промпт на русском. Без VPN, оплата картами РФ.",
  "heroMedia": {
    "userMessage": "Скандинавская гостиная: серый диван, большое окно, растения в кадках, утренний свет",
    "aiIntro": "Готово. Могу поменять любую деталь, **не трогая остальное**:",
    "aspect": "1:1",
    "resultCaption": "Скандинавская гостиная · утренний свет",
    "resultMeta": "Фотореализм · интерьер",
    "sample": {
      "src": "/images/model-landings/flux-3-image/living-room.webp",
      "alt": "Светлая скандинавская гостиная с серым диваном, большим окном и растениями — изображение, созданное Flux 3 Image в GIPITI",
      "width": 0,
      "height": 0
    }
  },
  "benefits": [
    {
      "icon": "layers",
      "title": "Рисует и редактирует",
      "text": "Создайте картинку с нуля или прикрепите свою и попросите правку — Flux 3 Image делает и то и другое, переключаться между моделями не нужно."
    },
    {
      "icon": "wand",
      "title": "Точечные правки без масок",
      "text": "Поменяйте цвет дивана или уберите лишний предмет словами — выделять область вручную не нужно, остальная часть кадра остаётся как была."
    },
    {
      "icon": "sparkles",
      "title": "Флагман нового поколения",
      "text": "Главная модель Black Forest Labs, вышедшая в октябре 2026 года, — следующая ступень после Flux 2 Max."
    },
    {
      "icon": "shield",
      "title": "Без VPN и зарубежных карт",
      "text": "Работает из России без ограничений. Оплата картами МИР, Visa, MasterCard или через СБП — в рублях."
    }
  ],
  "steps": [
    { "title": "Зарегистрируйтесь", "text": "Аккаунт за 30 секунд — нужен только email. Дарим 200 ₽ каждому новому пользователю." },
    { "title": "Выберите Flux 3 Image", "text": "Переключитесь на модель в списке — в один клик, как и на любую из 30+." },
    { "title": "Опишите картинку", "text": "Опишите сцену — или прикрепите изображение и скажите, что в нём изменить." },
    { "title": "Заберите результат", "text": "Изображение появится прямо в чате — скачайте его или попросите правку." }
  ],
  "audience": [
    {
      "title": "Дизайнеры интерьеров",
      "text": "Показать клиенту варианты отделки и мебели на одном и том же кадре комнаты.",
      "userMessage": "Покажи эту комнату с зелёным бархатным диваном вместо серого 📎 room.jpg",
      "aiReply": "**Правка** · диван стал зелёным, комната та же",
      "sample": {
        "src": "/images/model-landings/flux-3-image/green-sofa.webp",
        "alt": "Скандинавская гостиная с зелёным бархатным диваном у большого окна",
        "width": 0,
        "height": 0
      }
    },
    {
      "title": "Предметная съёмка",
      "text": "Кадры для каталога и рекламы без студии, света и реквизита.",
      "userMessage": "Флакон духов на мокром чёрном камне, капли воды, контровой свет",
      "aiReply": "**Предметный кадр** · флакон на мокром камне",
      "sample": {
        "src": "/images/model-landings/flux-3-image/perfume-stone.webp",
        "alt": "Стеклянный флакон духов на мокром чёрном камне с каплями воды в контровом свете",
        "width": 0,
        "height": 0
      }
    },
    {
      "title": "Иллюстраторы и издатели",
      "text": "Иллюстрации к книгам и статьям в заданной технике — и правки по ним в том же чате.",
      "userMessage": "Иллюстрация к сказке: лиса с фонарём идёт по зимнему лесу, гуашь",
      "aiReply": "**Иллюстрация** · лиса с фонарём, гуашь",
      "sample": {
        "src": "/images/model-landings/flux-3-image/fox-lantern.webp",
        "alt": "Гуашевая иллюстрация: лиса с фонарём идёт по ночному зимнему лесу",
        "width": 0,
        "height": 0
      }
    }
  ],
  "faq": [
    {
      "question": "Что такое Flux 3 Image?",
      "answer": "Flux 3 Image — флагманская модель Black Forest Labs для генерации и редактирования изображений, вышедшая в октябре 2026 года. В GIPITI она доступна без VPN, с промптом на русском и оплатой российскими картами."
    },
    {
      "question": "Чем Flux 3 Image отличается от Flux 2 Max?",
      "answer": "Flux 3 Image — новое поколение: одна модель и рисует, и редактирует, причём правит отдельные участки без ручных масок. Flux 2 Max остаётся сильным выбором для художественных стилей. Обе модели есть в GIPITI."
    },
    {
      "question": "Можно ли выбрать формат изображения?",
      "answer": "В GIPITI у Flux 3 Image нет настроек формата — модель сама подбирает пропорции под запрос. Если нужен точный формат кадра, выберите Nano Banana или Seedream: там соотношение сторон задаётся перед генерацией."
    },
    {
      "question": "Нужен ли VPN или зарубежная карта?",
      "answer": "Нет. GIPITI работает из России без ограничений, оплата — картами МИР, Visa, MasterCard или через СБП."
    },
    {
      "question": "Сколько это стоит?",
      "answer": "Запросы оплачиваются с баланса. Подписка 999 ₽/мес включает 999 ₽ на баланс каждый месяц, а каждому новому пользователю мы дарим 200 ₽ — хватит, чтобы попробовать."
    },
    {
      "question": "Нужно ли писать промпт на английском?",
      "answer": "Нет, описывайте задачу на русском. Если результат вышел не таким, добавьте деталей: что в кадре, стиль, ракурс, свет и настроение — это влияет сильнее, чем язык запроса."
    }
  ],
  "otherModels": [
    { "name": "Flux 2 Max", "tag": "Изображения", "href": "/models/flux-2-max" },
    { "name": "Flux 3 Video", "tag": "Видео", "href": "/models/flux-3-video" },
    { "name": "Nano Banana Pro", "tag": "Изображения", "href": "/models/nano-banana-pro" },
    { "name": "Recraft v4.1 Pro", "tag": "Изображения", "href": "/models/recraft-v4-1-pro" }
  ]
}
```

### Renders

Generate with **Flux 3 Image**. GIPITI has no format setting for this model,
so ask for the shape in the prompt and record what came out.

| File | Aspect | Prompt |
|---|---|---|
| `living-room.webp` (hero) | 1:1 | A bright Scandinavian living room: light grey linen sofa, large floor-to-ceiling window, potted fiddle-leaf fig and monstera in ceramic planters, pale oak floor, soft morning light, minimalist decor, photorealistic interior photography, square composition. |
| `green-sofa.webp` | 1:1 | Edit `living-room.webp`: replace the grey sofa with an emerald-green velvet sofa of the same shape and position; keep the window, plants, floor and lighting unchanged. (Run as an edit with the hero render attached — this tile shows the no-mask edit.) |
| `perfume-stone.webp` | 1:1 | Luxury product shot: a faceted glass perfume bottle with a gold cap standing on a wet black basalt stone, water droplets on the glass and stone, strong rim backlight, dark background, high-end advertising photography, square composition. |
| `fox-lantern.webp` | 1:1 | Children's book illustration in gouache: a red fox walking upright through a snowy night forest holding a glowing lantern, warm lantern light on the snow, deep blue shadows, visible brush texture, square composition. |

### Catalog card

```json
{
  "modelId": "flux-3-image",
  "name": "Flux 3 Image",
  "vendor": "BFL",
  "provider": "bfl",
  "category": "images",
  "description": "Новый флагман Black Forest Labs: генерация и точечное редактирование изображений в одной модели.",
  "tag": "Новинка",
  "hue": 315
}
```

---

## 3. MAI-Image 2.6

- Slug: `mai-image-2-6` → `MAI_IMAGE_26_SLUG`
- Model id: `mai-image-2.6` (gateway `microsoft/mai-image-2.6`)
- Target module: new `lib/marketing/model-landings/image-microsoft.ts`

### Landing

```json
{
  "kind": "image",
  "slug": "mai-image-2-6",
  "modelId": "mai-image-2.6",
  "name": "MAI-Image 2.6",
  "vendor": "Microsoft",
  "accent": "blue",
  "badge": "Microsoft AI · Точные правки · Изображения",
  "h1Top": "MAI-Image 2.6 —",
  "h1Gradient": "нейросеть Microsoft для изображений",
  "sub": "Модель Microsoft AI для генерации и редактирования изображений уже в GIPITI — точно меняет объекты, надписи и композицию по описанию на русском. Без VPN, с оплатой российскими картами. Дарим 200 ₽ каждому новому пользователю.",
  "ctaMain": "Попробовать MAI-Image 2.6",
  "metaTitle": "MAI-Image 2.6 — нейросеть Microsoft для картинок | GIPITI",
  "metaDescription": "MAI-Image 2.6 в GIPITI — генерация и точное редактирование изображений от Microsoft AI: объекты, надписи, композиция. Без VPN, на русском, оплата картами РФ.",
  "heroMedia": {
    "userMessage": "Кофейня дождливым вечером через запотевшее окно: люди за столиками, тёплый свет, широкий кадр",
    "aiIntro": "Готово — **широкий кадр**, как вы просили:",
    "aspect": "3:2",
    "resultCaption": "Кофейня за дождливым окном · тёплый свет",
    "resultMeta": "Широкий кадр · фотореализм",
    "sample": {
      "src": "/images/model-landings/mai-image-2-6/rainy-cafe.webp",
      "alt": "Кофейня с посетителями за столиками, видная через запотевшее окно с каплями дождя, — изображение, созданное MAI-Image 2.6 в GIPITI",
      "width": 0,
      "height": 0
    }
  },
  "benefits": [
    {
      "icon": "wand",
      "title": "Точные правки",
      "text": "Заменить объект, обновить надпись, перестроить композицию или убрать лишнее — на аккуратное редактирование Microsoft и делает ставку."
    },
    {
      "icon": "image",
      "title": "Генерация с нуля",
      "text": "Опишите сцену словами — модель нарисует её: от репортажного кадра до рекламного визуала."
    },
    {
      "icon": "ratio",
      "title": "Формат по описанию",
      "text": "Пропорции модель подбирает сама, исходя из запроса и исходной картинки: напишите «широкий баннер» или «вертикальный постер»."
    },
    {
      "icon": "shield",
      "title": "Без VPN и зарубежных карт",
      "text": "Работает из России без ограничений. Оплата картами МИР, Visa, MasterCard или через СБП — в рублях."
    }
  ],
  "steps": [
    { "title": "Зарегистрируйтесь", "text": "Аккаунт за 30 секунд — нужен только email. Дарим 200 ₽ каждому новому пользователю." },
    { "title": "Выберите MAI-Image 2.6", "text": "Переключитесь на модель в списке — в один клик, как и на любую из 30+." },
    { "title": "Опишите картинку", "text": "Что в кадре и какой нужен формат — или прикрепите изображение и опишите правку." },
    { "title": "Заберите результат", "text": "Изображение появится прямо в чате — скачайте его или попросите правку." }
  ],
  "audience": [
    {
      "title": "Маркетинг и e-commerce",
      "text": "Варианты одного товарного кадра под разные акции — без пересъёмки.",
      "userMessage": "Сделай кроссовок на этом фото красным, фон не меняй 📎 sneaker.jpg",
      "aiReply": "**Правка** · кроссовок стал красным",
      "sample": {
        "src": "/images/model-landings/mai-image-2-6/red-sneaker.webp",
        "alt": "Красный беговой кроссовок на бетонной ступеньке при дневном свете",
        "width": 0,
        "height": 0
      }
    },
    {
      "title": "Редакции и медиа",
      "text": "Иллюстрации к материалам в стиле журнальной съёмки, когда фотографа нет под рукой.",
      "userMessage": "Портрет пожилого часовщика за работой: лупа, мелкие детали, мягкий свет лампы",
      "aiReply": "**Портрет** · часовщик за работой",
      "sample": {
        "src": "/images/model-landings/mai-image-2-6/watchmaker.webp",
        "alt": "Пожилой часовщик с лупой склонился над механизмом часов в мягком свете настольной лампы",
        "width": 0,
        "height": 0
      }
    },
    {
      "title": "Презентации и обложки",
      "text": "Широкие баннеры и обложки слайдов — формат подстраивается под описание.",
      "userMessage": "Широкий баннер для презентации: команда обсуждает проект в светлом офисе",
      "aiReply": "**Широкий баннер** · команда в светлом офисе",
      "sample": {
        "src": "/images/model-landings/mai-image-2-6/team-banner.webp",
        "alt": "Команда обсуждает проект за столом с ноутбуками в светлом офисе, широкий кадр",
        "width": 0,
        "height": 0
      }
    }
  ],
  "faq": [
    {
      "question": "Что такое MAI-Image 2.6?",
      "answer": "MAI-Image 2.6 — модель Microsoft AI для генерации и редактирования изображений, ставшая общедоступной в октябре 2026 года. В GIPITI она работает без VPN, с промптом на русском и оплатой российскими картами."
    },
    {
      "question": "Чем MAI-Image 2.6 отличается от версии Flash?",
      "answer": "MAI-Image 2.6 — версия с упором на качество, Flash — более быстрая и экономичная: по прайсу Microsoft её выходные изображения примерно вдвое дешевле. Возможности генерации и правок у них одинаковые, обе модели есть в GIPITI."
    },
    {
      "question": "Можно ли выбрать формат и разрешение?",
      "answer": "Отдельных настроек нет: модель подбирает пропорции по описанию и исходной картинке, поэтому просто укажите в запросе «широкий» или «вертикальный» кадр. Разрешение — примерно до 1,5K. Если нужен 4K, выберите Nano Banana Pro."
    },
    {
      "question": "Нужен ли VPN или зарубежная карта?",
      "answer": "Нет. GIPITI работает из России без ограничений, оплата — картами МИР, Visa, MasterCard или через СБП."
    },
    {
      "question": "Сколько это стоит?",
      "answer": "Запросы оплачиваются с баланса. Подписка 999 ₽/мес включает 999 ₽ на баланс каждый месяц, а каждому новому пользователю мы дарим 200 ₽ — хватит, чтобы попробовать."
    },
    {
      "question": "Нужно ли писать промпт на английском?",
      "answer": "Нет, описывайте задачу на русском. Если результат вышел не таким, добавьте деталей: что в кадре, стиль, ракурс, свет и настроение — это влияет сильнее, чем язык запроса."
    }
  ],
  "otherModels": [
    { "name": "GPT Image 2.5 Sunburst", "tag": "Изображения", "href": "/models/gpt-image-2-5-sunburst" },
    { "name": "Nano Banana Pro", "tag": "Изображения", "href": "/models/nano-banana-pro" },
    { "name": "Seedream 5.0 Pro", "tag": "Изображения", "href": "/models/seedream-5-0-pro" },
    { "name": "Grok Imagine 2.0", "tag": "Изображения", "href": "/models/grok-imagine-2-0" }
  ]
}
```

### Renders

Generate with **MAI-Image 2.6**. Aspect ratio is derived from the prompt, so the
shape words in each prompt matter; record the real proportions.

| File | Aspect (target) | Prompt |
|---|---|---|
| `rainy-cafe.webp` (hero) | 3:2 | Wide landscape photo of a small cafe on a rainy evening, seen from the street through a fogged window with raindrops, people sitting at wooden tables inside, warm amber lighting, cool blue street reflections, cinematic, photorealistic. |
| `red-sneaker.webp` | 1:1 | Square product photo: a bright red running sneaker resting on a weathered concrete step, soft daylight, subtle shadow, clean urban background, sharp detail on the mesh and laces, photorealistic. (Or run as an edit: "make the sneaker red, keep the background" on a white-sneaker shot.) |
| `watchmaker.webp` | 3:4 | Vertical editorial portrait of an elderly watchmaker at his workbench, wearing a loupe, tweezers over an open pocket-watch movement, tiny gears on the bench, soft warm desk-lamp light, magazine photography, photorealistic. |
| `team-banner.webp` | 16:9 | Wide banner image for a presentation: a diverse team of four discussing a project around a table with laptops and sticky notes in a bright modern office with large windows, natural light, candid, photorealistic, no text. |

### Catalog card

```json
{
  "modelId": "mai-image-2.6",
  "name": "MAI-Image 2.6",
  "vendor": "Microsoft",
  "provider": "microsoft",
  "category": "images",
  "description": "Модель Microsoft AI с упором на качество: генерация и точное редактирование объектов, надписей и композиции.",
  "tag": "Новинка",
  "hue": 120
}
```

---

## 4. MAI-Image 2.6 Flash

- Slug: `mai-image-2-6-flash` → `MAI_IMAGE_26_FLASH_SLUG`
- Model id: `mai-image-2.6-flash` (gateway `microsoft/mai-image-2.6-flash`)
- Target module: new `lib/marketing/model-landings/image-microsoft.ts`

### Landing

```json
{
  "kind": "image",
  "slug": "mai-image-2-6-flash",
  "modelId": "mai-image-2.6-flash",
  "name": "MAI-Image 2.6 Flash",
  "vendor": "Microsoft",
  "accent": "sky",
  "badge": "Microsoft AI · Быстро и дешевле · Изображения",
  "h1Top": "MAI-Image 2.6 Flash —",
  "h1Gradient": "быстрые картинки от Microsoft",
  "sub": "Быстрая версия MAI-Image 2.6 уже в GIPITI — те же генерация и правки по описанию на русском, но быстрее и дешевле. Подходит, чтобы перебрать десяток идей за вечер. Без VPN, с оплатой российскими картами. Дарим 200 ₽ каждому новому пользователю.",
  "ctaMain": "Попробовать MAI-Image 2.6 Flash",
  "metaTitle": "MAI-Image 2.6 Flash — быстрая нейросеть Microsoft | GIPITI",
  "metaDescription": "MAI-Image 2.6 Flash в GIPITI — быстрая и недорогая генерация и редактирование изображений от Microsoft AI. Промпт на русском, без VPN, оплата картами РФ.",
  "heroMedia": {
    "userMessage": "Акварельная открытка: домик у моря, чайки над волнами, пастельные тона",
    "aiIntro": "Готово. Сделать ещё вариант в другой гамме?",
    "aspect": "1:1",
    "resultCaption": "Домик у моря · акварель, пастельные тона",
    "resultMeta": "Акварель · открытка",
    "sample": {
      "src": "/images/model-landings/mai-image-2-6-flash/seaside-postcard.webp",
      "alt": "Акварельная открытка с домиком у моря и чайками в пастельных тонах — изображение, созданное MAI-Image 2.6 Flash в GIPITI",
      "width": 0,
      "height": 0
    }
  },
  "benefits": [
    {
      "icon": "zap",
      "title": "Быстрее и дешевле",
      "text": "Flash — облегчённая версия MAI-Image 2.6: по прайсу Microsoft выходные изображения у неё примерно вдвое дешевле, поэтому перебирать варианты выгоднее."
    },
    {
      "icon": "wand",
      "title": "Те же правки, что у старшей версии",
      "text": "Заменить объект, обновить надпись, убрать лишнее из кадра — набор возможностей совпадает с MAI-Image 2.6."
    },
    {
      "icon": "layers",
      "title": "Правки в том же чате",
      "text": "Не понравился результат — скажите, что поменять, и получите новую версию. Вся серия остаётся в одном диалоге."
    },
    {
      "icon": "shield",
      "title": "Без VPN и зарубежных карт",
      "text": "Работает из России без ограничений. Оплата картами МИР, Visa, MasterCard или через СБП — в рублях."
    }
  ],
  "steps": [
    { "title": "Зарегистрируйтесь", "text": "Аккаунт за 30 секунд — нужен только email. Дарим 200 ₽ каждому новому пользователю." },
    { "title": "Выберите MAI-Image 2.6 Flash", "text": "Переключитесь на модель в списке — в один клик, как и на любую из 30+." },
    { "title": "Опишите картинку", "text": "Коротко опишите идею — уточнить детали можно следующим сообщением." },
    { "title": "Заберите результат", "text": "Изображение появится прямо в чате — скачайте его или попросите правку." }
  ],
  "audience": [
    {
      "title": "SMM и контент-планы",
      "text": "Картинки к ежедневным постам, когда их нужно много и быстро.",
      "userMessage": "Картинка к посту про утренний кофе: чашка на подоконнике, за окном снег",
      "aiReply": "**Картинка к посту** · кофе на зимнем подоконнике",
      "sample": {
        "src": "/images/model-landings/mai-image-2-6-flash/coffee-window.webp",
        "alt": "Чашка кофе на подоконнике, за окном идёт снег",
        "width": 0,
        "height": 0
      }
    },
    {
      "title": "Перебор идей",
      "text": "Концепты маскотов, упаковки и иллюстраций — десяток вариантов до того, как браться за финал.",
      "userMessage": "Концепт маскота для пекарни: весёлый круассан в поварском колпаке, мультяшный стиль",
      "aiReply": "**Концепт маскота** · круассан в колпаке",
      "sample": {
        "src": "/images/model-landings/mai-image-2-6-flash/croissant-mascot.webp",
        "alt": "Мультяшный маскот пекарни: улыбающийся круассан в поварском колпаке",
        "width": 0,
        "height": 0
      }
    },
    {
      "title": "Быстрая чистка фото",
      "text": "Убрать провода, прохожих и случайные предметы из кадра одной фразой.",
      "userMessage": "Убери с этого фото провода и столб на заднем плане 📎 street.jpg",
      "aiReply": "**Кадр очищен** · без проводов и столба",
      "sample": {
        "src": "/images/model-landings/mai-image-2-6-flash/clean-street.webp",
        "alt": "Тихая улочка старого города с цветами на балконах, без проводов и столбов",
        "width": 0,
        "height": 0
      }
    }
  ],
  "faq": [
    {
      "question": "Что такое MAI-Image 2.6 Flash?",
      "answer": "MAI-Image 2.6 Flash — быстрая и более дешёвая версия модели Microsoft AI для генерации и редактирования изображений, вышедшая в октябре 2026 года. В GIPITI она доступна без VPN и с оплатой российскими картами."
    },
    {
      "question": "Когда лучше взять MAI-Image 2.6 вместо Flash?",
      "answer": "Microsoft позиционирует MAI-Image 2.6 как версию с упором на качество, а Flash — как быструю и экономичную. Для черновиков и потока картинок хватает Flash; финальный визуал стоит сравнить на старшей модели — обе есть в GIPITI."
    },
    {
      "question": "Можно ли редактировать свои изображения?",
      "answer": "Да. Прикрепите картинку в чат и опишите правку словами: заменить предмет, поправить надпись, убрать лишнее. Формат кадра модель подбирает сама по описанию и исходному изображению."
    },
    {
      "question": "Нужен ли VPN или зарубежная карта?",
      "answer": "Нет. GIPITI работает из России без ограничений, оплата — картами МИР, Visa, MasterCard или через СБП."
    },
    {
      "question": "Сколько это стоит?",
      "answer": "Запросы оплачиваются с баланса. Подписка 999 ₽/мес включает 999 ₽ на баланс каждый месяц, а каждому новому пользователю мы дарим 200 ₽ — хватит, чтобы попробовать."
    },
    {
      "question": "Нужно ли писать промпт на английском?",
      "answer": "Нет, описывайте задачу на русском. Если результат вышел не таким, добавьте деталей: что в кадре, стиль, ракурс, свет и настроение — это влияет сильнее, чем язык запроса."
    }
  ],
  "otherModels": [
    { "name": "Seedream 5.0 Lite", "tag": "Изображения", "href": "/models/seedream-5-0-lite" },
    { "name": "Nano Banana Lite", "tag": "Изображения", "href": "/models/nano-banana-lite" },
    { "name": "Grok Imagine", "tag": "Изображения", "href": "/models/grok-imagine" },
    { "name": "GPT Image 2.5 Flare", "tag": "Изображения", "href": "/models/gpt-image-2-5-flare" }
  ]
}
```

### Renders

Generate with **MAI-Image 2.6 Flash** (not the full 2.6 — the landing says
these came from Flash).

| File | Aspect (target) | Prompt |
|---|---|---|
| `seaside-postcard.webp` (hero) | 1:1 | Square watercolor postcard: a small white cottage with a red roof on a grassy seaside hill, seagulls over gentle waves, soft pastel palette, visible paper texture and loose brush strokes, no text. |
| `coffee-window.webp` | 1:1 | Square cozy photo: a white ceramic cup of black coffee with steam on a wooden windowsill, a knitted blanket beside it, snow falling outside the window, soft morning light, photorealistic. |
| `croissant-mascot.webp` | 1:1 | Square cartoon mascot concept for a bakery: a cheerful golden croissant character with big eyes and a small smile, wearing a white chef's hat, simple flat colors, clean white background, no text. |
| `clean-street.webp` | 3:2 | Wide photo of a quiet cobblestone lane in a European old town, pastel houses with flower boxes on balconies, soft afternoon light, clear sky, no power lines, no poles, no people, photorealistic. (Or run as an edit: "remove the wires and the pole in the background" on a real street photo.) |

### Catalog card

```json
{
  "modelId": "mai-image-2.6-flash",
  "name": "MAI-Image 2.6 Flash",
  "vendor": "Microsoft",
  "provider": "microsoft",
  "category": "images",
  "description": "Быстрая и более дешёвая версия MAI-Image 2.6: те же генерация и правки изображений.",
  "tag": "Новинка",
  "hue": 120
}
```
