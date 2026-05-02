export type StyleTemplate = {
  id: string;
  nameKey: string;
  previewKey: string;
  examples: string[];
};

export type ProjectTemplate = {
  id: string;
  nameKey: string;
  previewKey: string;
  contextEntries: string[];
};

export const STYLE_TEMPLATES: readonly StyleTemplate[] = [
  {
    id: "brief",
    nameKey: "templates.brief.name",
    previewKey: "templates.brief.preview",
    examples: [
      "Будь кратко и отвечай только по делу, без филлеров и вступлений.",
      "Не поясняй очевидное. Если просят список — давай список, без обрамляющих абзацев.",
      "Используй короткие предложения. Один абзац — одна мысль.",
    ],
  },
  {
    id: "technical",
    nameKey: "templates.technical.name",
    previewKey: "templates.technical.preview",
    examples: [
      "Используй точную терминологию. Указывай версии библиотек и операционных систем.",
      "Когда даёшь код — добавляй комментарии и обработку краёв.",
    ],
  },
  {
    id: "friendly",
    nameKey: "templates.friendly.name",
    previewKey: "templates.friendly.preview",
    examples: [
      "Пиши тепло, как будто объясняешь другу за чашкой кофе. Можно лёгкий юмор.",
    ],
  },
  {
    id: "teacher",
    nameKey: "templates.teacher.name",
    previewKey: "templates.teacher.preview",
    examples: [
      "Объясняй с нуля, шаг за шагом. После сложного места — задавай проверочный вопрос.",
    ],
  },
];

export const PROJECT_TEMPLATES: readonly ProjectTemplate[] = [
  {
    id: "coursework",
    nameKey: "templates.coursework.name",
    previewKey: "templates.coursework.preview",
    contextEntries: [
      "Тема: цифровая трансформация средних предприятий в России 2020–2025. Ссылки оформлять по ГОСТ Р 7.0.5-2008.",
    ],
  },
  {
    id: "blog",
    nameKey: "templates.blog.name",
    previewKey: "templates.blog.preview",
    contextEntries: [
      "Тон: разговорный, от первого лица. Длина 600–900 слов. Закрывающий абзац — вопрос читателю.",
    ],
  },
  {
    id: "legal",
    nameKey: "templates.legal.name",
    previewKey: "templates.legal.preview",
    contextEntries: [
      'Подпись: Иван Иванов, юрисконсульт, ООО "Бета". Реквизиты: ИНН ..., ОГРН ...',
    ],
  },
];
