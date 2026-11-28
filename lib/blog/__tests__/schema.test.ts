import { describe, expect, it } from "vitest";

import { blogFrontmatterSchema, getModifiedDate } from "../schema";

const baseFrontmatter = {
  title: "Заголовок",
  description: "Описание",
  slug: "zagolovok",
  date: "2026-07-03",
  category: "Гайды",
};

describe("blogFrontmatterSchema updated", () => {
  it("accepts a frontmatter without `updated`", () => {
    const result = blogFrontmatterSchema.safeParse(baseFrontmatter);

    expect(result.success).toBe(true);
  });

  it("accepts a valid `updated` after the publication date", () => {
    const result = blogFrontmatterSchema.safeParse({
      ...baseFrontmatter,
      updated: "2026-11-28",
    });

    expect(result.success).toBe(true);
  });

  it("accepts `updated` equal to the publication date", () => {
    const result = blogFrontmatterSchema.safeParse({
      ...baseFrontmatter,
      updated: "2026-07-03",
    });

    expect(result.success).toBe(true);
  });

  it("normalises an unquoted YAML date object", () => {
    const result = blogFrontmatterSchema.safeParse({
      ...baseFrontmatter,
      updated: new Date("2026-11-28T00:00:00Z"),
    });

    expect(result.success && result.data.updated).toBe("2026-11-28");
  });

  it("rejects a malformed `updated`", () => {
    const result = blogFrontmatterSchema.safeParse({
      ...baseFrontmatter,
      updated: "28.11.2026",
    });

    expect(result.success).toBe(false);
  });

  it("rejects `updated` earlier than the publication date", () => {
    const result = blogFrontmatterSchema.safeParse({
      ...baseFrontmatter,
      updated: "2026-07-02",
    });

    expect(result.success).toBe(false);
  });
});

describe("getModifiedDate", () => {
  it("returns `updated` when it is set", () => {
    const modified = getModifiedDate({
      date: "2026-07-03",
      updated: "2026-11-28",
    });

    expect(modified).toBe("2026-11-28");
  });

  it("falls back to the publication date", () => {
    const modified = getModifiedDate({ date: "2026-07-03" });

    expect(modified).toBe("2026-07-03");
  });
});
