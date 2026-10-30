/** Landing for the Xiaomi text model: MiMo v2.6 Pro. */

import {
  analystsAudience,
  buildSteps,
  DEEPSEEK_SLUG,
  KIMI_K31_PRO_SLUG,
  MIMO_V26_PRO_SLUG,
  MINIMAX_M31_FLASH_SLUG,
  priceFaq,
  QWEN_38_MAX_PRIME_SLUG,
  vpnBenefit,
  vpnFaq,
} from "./shared";
import type { ModelLanding } from "./types";

export const xiaomiLandings: ModelLanding[] = [
  {
    kind: "text",
    slug: MIMO_V26_PRO_SLUG,
    modelId: "mimo-v2.6-pro",
    name: "MiMo v2.6 Pro",
    vendor: "Xiaomi",
    accent: "teal",
    badge: "Xiaomi · Флагман MiMo · Текст",
    h1Top: "Xiaomi MiMo v2.6 Pro —",
    h1Gradient: "рассуждающая нейросеть Xiaomi",
    sub: "Флагманская модель Xiaomi уже в GIPITI — решает задачи пошагово, понимает изображения и держит контекст около миллиона токенов, а стоит заметно меньше западных флагманов. Без VPN, на русском, с оплатой российскими картами. Дарим 200 ₽ каждому новому пользователю.",
    ctaMain: "Попробовать MiMo v2.6 Pro",
    metaTitle: "Xiaomi MiMo v2.6 Pro — нейросеть Xiaomi без VPN | GIPITI",
    metaDescription:
      "Xiaomi MiMo v2.6 Pro в GIPITI — флагман Xiaomi с рассуждениями, пониманием фото и контекстом около 1 млн токенов. Без VPN, на русском, оплата картами РФ.",
    heroChat: {
      userMessage: "Реши задачу с фото и проверь мой ответ 📷 zadacha.jpg",
      aiIntro: "Решил заново и сверил. **Ошибка у вас на втором шаге**:",
      aiBullets: [
        "**Шаг 2** — при переносе слагаемого потерялся минус",
        "**Верный ответ** — x = 4, а не x = −4",
        "**Проверка** — подставляем 4: обе части равны 11",
      ],
    },
    benefits: [
      {
        icon: "sparkles",
        title: "Решает пошагово",
        text: "MiMo v2.6 Pro продумывает решение перед ответом: математика, логика, алгоритмы — задачи, где важно не ошибиться в цепочке выводов.",
      },
      {
        icon: "image",
        title: "Понимает изображения",
        text: "Фото задачи, скриншот, схема или график — прикрепите картинку, и модель разберёт её вместе с текстом вопроса.",
      },
      {
        icon: "wallet",
        title: "Флагман по невысокой цене",
        text: "Старшая модель Xiaomi стоит заметно меньше западных флагманов — запросы расходуют баланс медленно, и на сложные задачи его хватает надолго.",
      },
      vpnBenefit,
    ],
    steps: buildSteps(
      "MiMo v2.6 Pro",
      "Текстом на русском — или прикрепите фото, скриншот или файл Word."
    ),
    audience: [
      {
        title: "Школьники и студенты",
        text: "Фото задачи — и пошаговое решение с объяснением, где обычно ошибаются.",
        userMessage: "Почему у меня не сошёлся ответ? 📷 reshenie.jpg",
        aiReply:
          "Ошибка в **третьей строке**: в квадрат возведено только первое слагаемое, а нужно…",
      },
      {
        title: "Разработчики",
        text: "Алгоритмы, отладка и оптимизация с рассуждением — модель объясняет, почему решение работает.",
        userMessage: "Ускорь этот алгоритм — сейчас он работает за квадрат",
        aiReply:
          "Можно за **O(n log n)**: отсортируем точки и пройдём по ним одним указателем…",
      },
      analystsAudience,
    ],
    faq: [
      {
        question: "Что такое Xiaomi MiMo v2.6 Pro?",
        answer:
          "MiMo v2.6 Pro — флагманская мультимодальная модель Xiaomi с рассуждениями, вышедшая в сентябре 2026 года. Она работает с контекстом около миллиона токенов, выдаёт до 128 тысяч токенов за ответ и умеет вызывать инструменты. В GIPITI доступна без VPN, на русском и с оплатой российскими картами.",
      },
      {
        question: "Это та самая Xiaomi, которая делает смартфоны?",
        answer:
          "Да. MiMo — линейка языковых моделей Xiaomi. Кроме Pro в ней есть облегчённая MiMo v2.6 Flash и ускоренная версия Pro UltraSpeed; в GIPITI доступна старшая модель — v2.6 Pro.",
      },
      {
        question: "Какой контекст у MiMo v2.6 Pro?",
        answer:
          "Около миллиона токенов — это сотни страниц текста в одном диалоге. Ответ может занимать до 128 тысяч токенов, так что объёмный отчёт или большой фрагмент кода модель выдаст за один раз.",
      },
      {
        question: "Можно ли прикреплять файлы?",
        answer:
          "Да — изображения (фото, скриншоты, схемы) и файлы Word. Аудио и видео в чате GIPITI модель пока не принимает, а PDF лучше отдать Gemini, GPT-6 или Claude.",
      },
      vpnFaq,
      priceFaq,
    ],
    otherModels: [
      {
        name: "MiniMax M3.1 Flash",
        tag: "Текст",
        href: `/models/${MINIMAX_M31_FLASH_SLUG}`,
      },
      {
        name: "Kimi K3.1 Pro",
        tag: "Текст",
        href: `/models/${KIMI_K31_PRO_SLUG}`,
      },
      {
        name: "Qwen 3.8 Max Prime",
        tag: "Текст",
        href: `/models/${QWEN_38_MAX_PRIME_SLUG}`,
      },
      {
        name: "DeepSeek V4 Pro",
        tag: "Текст",
        href: `/models/${DEEPSEEK_SLUG}`,
      },
    ],
  },
];
