export type ProjectTemplate = {
  id: string;
  nameKey: string;
  previewKey: string;
  contextEntries: string[];
};

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
