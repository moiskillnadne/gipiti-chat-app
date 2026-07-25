import { describe, expect, it } from "vitest";

import { apiCatalog } from "../api-catalog";
import { isMarkdownNegotiablePath } from "../markdown/paths";
import { openApiDocument } from "../openapi";
import { agentSkills, buildAgentSkillsIndex, digestSkill } from "../skills";
import { webMcpTools } from "../webmcp-tools";

const HTTPS_URL = /^https:\/\//;
const SHA256_DIGEST = /^sha256:[a-f0-9]{64}$/;
/** Agent Skills 0.2.0: lowercase alphanumeric with single hyphens. */
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** WebMCP tool names: ASCII alphanumeric, `_`, `-`, `.`, 1–128 chars. */
const WEBMCP_TOOL_NAME = /^[\w.-]{1,128}$/;

describe("isMarkdownNegotiablePath", () => {
  it.each(["/", "/models", "/blog", "/models/text", "/blog/some-article"])(
    "accepts the public page %s",
    (pathname) => {
      expect(isMarkdownNegotiablePath(pathname)).toBe(true);
    }
  );

  it.each([
    ["the secret-gated author tool", "/blog/preview"],
    ["a session-gated page", "/chat"],
    ["a nested chat url", "/chat/abc"],
    ["the subscription area", "/subscription/usage"],
    ["an internal api route", "/api/health"],
    ["a deeper models path", "/models/text/extra"],
    ["an unknown path", "/nope"],
  ])("rejects %s", (_label, pathname) => {
    expect(isMarkdownNegotiablePath(pathname)).toBe(false);
  });

  it("does not let a traversal segment escape the allowlist", () => {
    expect(isMarkdownNegotiablePath("/models/../chat")).toBe(false);
  });
});

describe("apiCatalog", () => {
  it("uses the RFC 9264 relation-keyed shape, not Link-header syntax", () => {
    const [entry] = apiCatalog.linkset;

    expect(entry.anchor).toMatch(HTTPS_URL);
    expect(entry).not.toHaveProperty("links");
    expect(entry["service-desc"]?.[0]?.href).toBe(
      "https://gipiti.ru/openapi.json"
    );
  });

  it("points service-desc at a document the app actually serves", () => {
    const [entry] = apiCatalog.linkset;
    const described = Object.keys(openApiDocument.paths);

    expect(entry["service-desc"]).toBeDefined();
    expect(described.length).toBeGreaterThan(0);
  });

  it("advertises only endpoints described in the OpenAPI document", () => {
    const [entry] = apiCatalog.linkset;
    const statusHref = entry.status?.[0]?.href ?? "";

    expect(statusHref.endsWith("/api/health")).toBe(true);
    expect(Object.keys(openApiDocument.paths)).toContain("/api/health");
  });
});

describe("agent skills index", () => {
  it("publishes a digest matching the served document body", () => {
    const index = buildAgentSkillsIndex();

    for (const entry of index.skills) {
      const skill = agentSkills.find((item) => item.name === entry.name);

      expect(skill).toBeDefined();
      expect(entry.digest).toBe(digestSkill(skill as (typeof agentSkills)[0]));
      expect(entry.digest).toMatch(SHA256_DIGEST);
    }
  });

  it("uses names that are valid url segments", () => {
    for (const skill of agentSkills) {
      expect(skill.name).toMatch(SKILL_NAME);
    }
  });

  it("starts each document with frontmatter naming the skill", () => {
    for (const skill of agentSkills) {
      expect(skill.body.startsWith("---\n")).toBe(true);
      expect(skill.body).toContain(`name: ${skill.name}`);
    }
  });
});

describe("webMcpTools", () => {
  it("declares an object input schema for every tool", () => {
    for (const tool of webMcpTools) {
      expect(tool.name).toMatch(WEBMCP_TOOL_NAME);
      expect(tool.description.length).toBeGreaterThan(0);
      expect(tool.inputSchema).toMatchObject({ type: "object" });
    }
  });

  it("lists every catalog model when no category is given", async () => {
    const tool = webMcpTools.find((item) => item.name === "list_gipiti_models");
    const result = await tool?.execute({});

    expect(result?.content[0]?.text).toContain("Все модели GIPITI");
  });

  it("narrows the listing to the requested category", async () => {
    const tool = webMcpTools.find((item) => item.name === "list_gipiti_models");
    const result = await tool?.execute({ category: "video" });

    expect(result?.content[0]?.text).toContain("video");
  });

  it("ignores an unknown category rather than returning nothing", async () => {
    const tool = webMcpTools.find((item) => item.name === "list_gipiti_models");
    const result = await tool?.execute({ category: "nonsense" });

    expect(result?.content[0]?.text).toContain("Все модели GIPITI");
  });

  it("asks for a query instead of dumping the catalog on empty search", async () => {
    const tool = webMcpTools.find(
      (item) => item.name === "search_gipiti_models"
    );
    const result = await tool?.execute({ query: "   " });

    expect(result?.content[0]?.text).toContain("query");
  });

  it("matches a search against vendor names", async () => {
    const tool = webMcpTools.find(
      (item) => item.name === "search_gipiti_models"
    );
    const result = await tool?.execute({ query: "openai" });

    expect(result?.content[0]?.text).toContain("Найдено моделей:");
  });

  it("reports the subscription price", async () => {
    const tool = webMcpTools.find((item) => item.name === "get_gipiti_pricing");
    const result = await tool?.execute({});

    expect(result?.content[0]?.text).toContain("999 ₽ в месяц");
  });
});
