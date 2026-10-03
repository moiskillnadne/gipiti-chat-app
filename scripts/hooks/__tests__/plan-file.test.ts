import { describe, expect, it } from "vitest";

import {
  buildPlanFileName,
  extractPlanTitle,
  renderPlanDocument,
  slugifyTitle,
} from "../plan-file";

describe("extractPlanTitle", () => {
  it("returns the first H1 without a redundant 'Plan:' prefix", () => {
    const plan =
      "Intro text\n\n# Plan: add billing webhooks\n\n## Steps\n# Second";

    expect(extractPlanTitle(plan)).toBe("add billing webhooks");
  });

  it("strips the Russian 'План —' prefix", () => {
    expect(extractPlanTitle("# План — история планов")).toBe("история планов");
  });

  it("keeps a heading that consists only of the prefix word", () => {
    expect(extractPlanTitle("# Plan")).toBe("Plan");
  });

  it("returns null when the plan has no H1", () => {
    expect(extractPlanTitle("## Context\nNo top-level heading")).toBeNull();
  });
});

describe("slugifyTitle", () => {
  it("produces a kebab-case ASCII slug", () => {
    expect(slugifyTitle("Add Billing Webhooks (v2)!")).toBe(
      "add-billing-webhooks-v2"
    );
  });

  it("transliterates Cyrillic instead of dropping it", () => {
    expect(slugifyTitle("Сохранение планов в docs")).toBe(
      "sokhranenie-planov-v-docs"
    );
  });

  it("caps the slug at 50 characters without a trailing dash", () => {
    const slug = slugifyTitle("word ".repeat(30));

    expect(slug.length).toBeLessThanOrEqual(50);
    expect(slug.endsWith("-")).toBe(false);
  });

  it("falls back to 'plan' for missing or symbol-only titles", () => {
    expect(slugifyTitle(null)).toBe("plan");
    expect(slugifyTitle("🚀 ✨")).toBe("plan");
  });
});

describe("buildPlanFileName", () => {
  it("uses date and slug when the name is free", () => {
    expect(buildPlanFileName("2026-10-03", "plan-history", new Set())).toBe(
      "2026-10-03-plan-history.md"
    );
  });

  it("adds a numeric suffix instead of overwriting an existing plan", () => {
    const existingFileNames = new Set([
      "2026-10-03-plan-history.md",
      "2026-10-03-plan-history-2.md",
    ]);

    expect(
      buildPlanFileName("2026-10-03", "plan-history", existingFileNames)
    ).toBe("2026-10-03-plan-history-3.md");
  });
});

describe("renderPlanDocument", () => {
  it("prepends frontmatter with date, status, branch and session", () => {
    const document = renderPlanDocument("\n# Plan: x\n\nBody\n\n", {
      date: "2026-10-03",
      branch: "feature/x",
      sessionId: "abc-123",
    });

    expect(document).toBe(
      [
        "---",
        "date: 2026-10-03",
        "status: accepted",
        "branch: feature/x",
        "session: abc-123",
        "---",
        "",
        "# Plan: x",
        "",
        "Body",
        "",
      ].join("\n")
    );
  });

  it("omits branch and session when unknown", () => {
    const document = renderPlanDocument("# Plan", {
      date: "2026-10-03",
      branch: null,
      sessionId: null,
    });

    expect(document).toBe(
      "---\ndate: 2026-10-03\nstatus: accepted\n---\n\n# Plan\n"
    );
  });
});
