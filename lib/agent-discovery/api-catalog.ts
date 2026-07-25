import { absoluteUrl } from "./constants";

/**
 * API catalog document (RFC 9727), served from `/.well-known/api-catalog`.
 *
 * The payload is a linkset in the JSON representation defined by RFC 9264 §4.2:
 * one object per API, keyed by `anchor`, where every other member is a link
 * relation type mapping to an array of targets. Note that relations are object
 * keys here — the `[{ "rel": ..., "href": ... }]` shape belongs to the HTTP
 * `Link` header grammar, not to `application/linkset+json`.
 */

export const API_CATALOG_CONTENT_TYPE = "application/linkset+json";

type LinkTarget = {
  href: string;
  type?: string;
  title?: string;
};

type LinkContext = {
  anchor: string;
  "service-desc"?: LinkTarget[];
  "service-doc"?: LinkTarget[];
  "service-meta"?: LinkTarget[];
  status?: LinkTarget[];
  "terms-of-service"?: LinkTarget[];
};

type Linkset = {
  linkset: LinkContext[];
};

export const apiCatalog: Linkset = {
  linkset: [
    {
      anchor: absoluteUrl("/api"),
      "service-desc": [
        {
          href: absoluteUrl("/openapi.json"),
          type: "application/json",
          title: "GIPITI Public API — OpenAPI 3.1 description",
        },
      ],
      "service-doc": [
        {
          href: absoluteUrl("/models"),
          type: "text/html",
          title: "Каталог доступных AI-моделей",
        },
      ],
      "service-meta": [
        {
          href: absoluteUrl("/.well-known/agent-skills/index.json"),
          type: "application/json",
          title: "Навыки для агентов (Agent Skills Discovery 0.2.0)",
        },
      ],
      status: [
        {
          href: absoluteUrl("/api/health"),
          type: "application/json",
          title: "Состояние сервиса",
        },
      ],
      "terms-of-service": [
        {
          href: absoluteUrl("/legal/offer"),
          type: "text/html",
          title: "Публичная оферта",
        },
      ],
    },
  ],
};
