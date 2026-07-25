import { createHash } from "node:crypto";

import {
  SUBSCRIPTION_PRICE_RUB,
  WELCOME_BONUS_RUB,
} from "@/lib/marketing/landing-content";
import {
  catalogSections,
  getModelsByCategory,
} from "@/lib/marketing/models-catalog";

import { absoluteUrl } from "./constants";

/**
 * Skills published under `/.well-known/agent-skills/`, per the Agent Skills
 * Discovery RFC 0.2.0 (agentskills.io).
 *
 * A skill is a document that tells an agent how to work with this site. Both
 * are generated from the live model catalog and pricing constants, so a new
 * model shows up in the published skill on the next deploy without anyone
 * remembering to edit it.
 *
 * Text is Russian to match the product — the interface, the models' system
 * prompts and every marketing page are Russian-only.
 */

export const SKILLS_INDEX_SCHEMA =
  "https://schemas.agentskills.io/discovery/0.2.0/schema.json";

export type AgentSkillDefinition = {
  /** Lowercase alphanumeric + hyphens; also the URL segment. */
  name: string;
  description: string;
  /** Full SKILL.md document, frontmatter included. */
  body: string;
};

const frontmatter = (name: string, description: string): string =>
  ["---", `name: ${name}`, `description: ${description}`, "---", ""].join("\n");

const GETTING_STARTED_NAME = "gipiti-getting-started";
const GETTING_STARTED_DESCRIPTION =
  "Что такое GIPITI, как получить доступ к AI-моделям, как устроены баланс и подписка.";

const MODEL_SELECTION_NAME = "gipiti-model-selection";
const MODEL_SELECTION_DESCRIPTION =
  "Как выбрать AI-модель на GIPITI под задачу: текст, изображения, видео или код.";

const buildGettingStartedBody = (): string =>
  frontmatter(GETTING_STARTED_NAME, GETTING_STARTED_DESCRIPTION) +
  [
    "# Начало работы с GIPITI",
    "",
    "GIPITI (Гипити) — российская платформа-агрегатор нейросетей: один чат с доступом",
    "к моделям OpenAI, Google, Anthropic, xAI, DeepSeek, Perplexity, Kling AI,",
    "ByteDance, BFL и Recraft. Работает без VPN, интерфейс на русском языке.",
    "",
    "## Доступ",
    "",
    `1. Регистрация по email с подтверждением кода: ${absoluteUrl("/register")}`,
    `2. На баланс сразу начисляется ${WELCOME_BONUS_RUB} ₽ — хватает, чтобы попробовать все функции.`,
    `3. Вход для существующих аккаунтов: ${absoluteUrl("/login")}`,
    "",
    "## Как устроена оплата",
    "",
    `- Подписка стоит ${SUBSCRIPTION_PRICE_RUB} ₽ в месяц и каждый месяц зачисляет ${SUBSCRIPTION_PRICE_RUB} ₽ на баланс.`,
    "- Баланс списывается за фактические запросы и ответы моделей, а не за количество сообщений.",
    "- Баланс можно пополнить отдельно в любой момент.",
    "- Принимаются карты Visa, MasterCard и МИР; расчёты в рублях.",
    "- Подписку можно отменить в личном кабинете, доступ сохраняется до конца оплаченного периода.",
    "",
    "## Что важно знать агенту",
    "",
    "- Чат работает только в браузере после входа: публичного API для сторонних",
    "  клиентов нет, и API-ключи не выдаются. Не пытайтесь вызывать `/api/chat`.",
    `- Состояние сервиса: ${absoluteUrl("/api/health")}`,
    "- Публичные страницы отдают Markdown, если запросить их с заголовком",
    "  `Accept: text/markdown` — это дешевле, чем парсить HTML.",
    `- Каталог моделей: ${absoluteUrl("/models")}`,
    `- Условия использования: ${absoluteUrl("/legal/offer")}`,
    "",
  ].join("\n");

const buildModelSelectionBody = (): string =>
  frontmatter(MODEL_SELECTION_NAME, MODEL_SELECTION_DESCRIPTION) +
  [
    "# Выбор модели на GIPITI",
    "",
    "Модель переключается в самом чате, отдельная подписка на каждого провайдера",
    "не нужна. Ниже — что доступно по категориям задач.",
    "",
    ...catalogSections.flatMap((section) => [
      `## ${section.categoryLabel}`,
      "",
      section.intro,
      "",
      ...getModelsByCategory(section.id).map(
        (model) =>
          `- **${model.name}** (${model.vendor}) — ${model.description}`
      ),
      "",
      `Страница категории: ${absoluteUrl(`/models/${section.slug}`)}`,
      "",
    ]),
    "## Как выбирать",
    "",
    "- Длинные документы, рассуждения и агентные задачи — флагманские текстовые модели.",
    "- Нужны свежие факты — модели со встроенным поиском либо включённый веб-поиск.",
    "- Картинка по описанию или правка готовой — модели категории «Изображения».",
    "- Ролик по тексту или из кадра — модели категории «Видео».",
    "- Код, отладка и рефакторинг — модели категории «Код».",
    "",
    "Стоимость запроса зависит от выбранной модели и списывается с баланса,",
    "поэтому для простых задач дешевле брать младшие модели линейки.",
    "",
  ].join("\n");

export const agentSkills: AgentSkillDefinition[] = [
  {
    name: GETTING_STARTED_NAME,
    description: GETTING_STARTED_DESCRIPTION,
    body: buildGettingStartedBody(),
  },
  {
    name: MODEL_SELECTION_NAME,
    description: MODEL_SELECTION_DESCRIPTION,
    body: buildModelSelectionBody(),
  },
];

export const getAgentSkillByName = (
  name: string
): AgentSkillDefinition | undefined =>
  agentSkills.find((skill) => skill.name === name);

/** `sha256:{hex}` over the exact bytes served at the skill's URL. */
export const digestSkill = (skill: AgentSkillDefinition): string =>
  `sha256:${createHash("sha256").update(skill.body, "utf8").digest("hex")}`;

export const skillUrl = (skill: AgentSkillDefinition): string =>
  absoluteUrl(`/.well-known/agent-skills/${skill.name}/SKILL.md`);

type AgentSkillsIndex = {
  $schema: string;
  skills: {
    name: string;
    type: "skill-md";
    description: string;
    url: string;
    digest: string;
  }[];
};

export const buildAgentSkillsIndex = (): AgentSkillsIndex => ({
  $schema: SKILLS_INDEX_SCHEMA,
  skills: agentSkills.map((skill) => ({
    name: skill.name,
    type: "skill-md",
    description: skill.description,
    url: skillUrl(skill),
    digest: digestSkill(skill),
  })),
});
