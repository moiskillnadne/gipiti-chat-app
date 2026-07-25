import { absoluteUrl, SITE_ORIGIN } from "./constants";

/**
 * OpenAPI description of GIPITI's *public* HTTP surface.
 *
 * Deliberately small. Everything under `/api` that touches chats, projects,
 * balances or payments is authenticated with a NextAuth session cookie and is
 * an internal contract between this app's own client and server — it is not a
 * third-party API, has no versioning guarantees, and is not documented here.
 * Advertising it would point agents at endpoints that will reject them.
 *
 * Add an operation here only when it is genuinely callable by an unauthenticated
 * third party and we intend to keep it stable.
 */

type OpenApiDocument = {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
    contact: { url: string };
    termsOfService: string;
  };
  servers: { url: string; description: string }[];
  paths: Record<string, unknown>;
  components: { schemas: Record<string, unknown> };
};

const DESCRIPTION = [
  "Публичная часть HTTP-интерфейса GIPITI — платформы доступа к AI-моделям",
  "(https://gipiti.ru).",
  "",
  "Основной чат-API работает по сессионной аутентификации и предназначен",
  "только для собственного клиента приложения, поэтому здесь не описан.",
  "",
  "Что доступно агентам без авторизации:",
  "",
  "- `GET /api/health` — состояние сервиса (описано ниже);",
  "- Markdown-версия публичных страниц: тот же URL с заголовком",
  "  `Accept: text/markdown` возвращает `text/markdown` вместо HTML",
  "  (`/`, `/models`, `/models/{slug}`, `/blog`, `/blog/{slug}`);",
  "- каталог моделей и навыки для агентов —",
  "  `/.well-known/api-catalog` и `/.well-known/agent-skills/index.json`.",
].join("\n");

const healthCheckSchema = {
  type: "object",
  properties: {
    status: { type: "string", enum: ["up", "down"] },
    latency: {
      type: "integer",
      description: "Длительность проверки в миллисекундах",
    },
    error: { type: "string" },
  },
  required: ["status"],
};

export const openApiDocument: OpenApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "GIPITI Public API",
    version: "1.0.0",
    description: DESCRIPTION,
    contact: { url: absoluteUrl("/legal/support") },
    termsOfService: absoluteUrl("/legal/offer"),
  },
  servers: [{ url: SITE_ORIGIN, description: "Production" }],
  paths: {
    "/api/health": {
      get: {
        operationId: "getHealth",
        summary: "Состояние сервиса",
        description:
          "Проверяет доступность базы данных, Redis и обязательных переменных окружения. Не требует авторизации и не кэшируется.",
        tags: ["status"],
        responses: {
          "200": {
            description:
              "Сервис работает. `degraded` означает, что отказала только необязательная зависимость (Redis).",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/HealthResponse" },
              },
            },
          },
          "503": {
            description:
              "Отказала обязательная зависимость — база данных или конфигурация окружения.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/HealthResponse" },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      HealthResponse: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["healthy", "degraded", "unhealthy"],
          },
          timestamp: { type: "string", format: "date-time" },
          version: { type: "string" },
          checks: {
            type: "object",
            properties: {
              database: { $ref: "#/components/schemas/HealthCheck" },
              redis: { $ref: "#/components/schemas/HealthCheck" },
              environment: { $ref: "#/components/schemas/HealthCheck" },
            },
            required: ["database", "redis", "environment"],
          },
        },
        required: ["status", "timestamp", "version", "checks"],
      },
      HealthCheck: healthCheckSchema,
    },
  },
};
