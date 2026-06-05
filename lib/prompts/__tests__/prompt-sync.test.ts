import { describe, expect, it } from "vitest";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import {
  type PromptSeed,
  type SheetRow,
  validateSheetRows,
} from "../prompt-seed";
import { buildSyncPlan, type ExistingPrompt } from "../prompt-sync";

const VALID_MODEL = DEFAULT_CHAT_MODEL;

function makeRow(overrides: Partial<SheetRow>): SheetRow {
  return {
    rowNumber: 2,
    key: "t1",
    category: "text",
    model: VALID_MODEL,
    title: "Summarize a meeting",
    body: "Summarize the [meeting] notes.",
    ...overrides,
  };
}

function makeSeed(overrides: Partial<PromptSeed>): PromptSeed {
  return {
    key: "t1",
    category: "text",
    modelId: VALID_MODEL,
    title: "Summarize a meeting",
    body: "Summarize the [meeting] notes.",
    tags: [],
    isActive: true,
    sortOrder: 0,
    ...overrides,
  };
}

function makeExisting(overrides: Partial<ExistingPrompt>): ExistingPrompt {
  return {
    key: "t1",
    category: "text",
    modelId: VALID_MODEL,
    title: "Summarize a meeting",
    body: "Summarize the [meeting] notes.",
    tags: [],
    sortOrder: 0,
    isActive: true,
    ...overrides,
  };
}

describe("validateSheetRows", () => {
  it("normalizes a valid row into a seed", () => {
    const { seeds, errors } = validateSheetRows([
      makeRow({ tags: "Work, Summary, Work" }),
    ]);

    expect(errors).toHaveLength(0);
    expect(seeds).toHaveLength(1);
    expect(seeds[0]).toMatchObject({
      key: "t1",
      category: "text",
      modelId: VALID_MODEL,
      tags: ["Work", "Summary"],
      isActive: true,
      sortOrder: 0,
    });
  });

  it("accepts the Russian category label as an alias", () => {
    const { seeds, errors } = validateSheetRows([
      makeRow({ category: "Текст" }),
    ]);

    expect(errors).toHaveLength(0);
    expect(seeds[0].category).toBe("text");
  });

  it("treats recognized falsy values in 'active' as inactive", () => {
    const { seeds } = validateSheetRows([makeRow({ active: "false" })]);
    expect(seeds[0].isActive).toBe(false);
  });

  it("reports missing required fields", () => {
    const { seeds, errors } = validateSheetRows([
      makeRow({ key: "", title: "  ", body: "" }),
    ]);

    expect(seeds).toHaveLength(0);
    expect(errors[0].messages).toEqual(
      expect.arrayContaining([
        "Missing 'key'",
        "Missing 'title'",
        "Missing 'body'",
      ])
    );
  });

  it("rejects an unknown category and an unknown model", () => {
    const { errors } = validateSheetRows([
      makeRow({ category: "nope", model: "made-up-model" }),
    ]);

    expect(errors[0].messages).toEqual(
      expect.arrayContaining([
        "Unknown 'category': \"nope\"",
        "Unknown 'model': \"made-up-model\"",
      ])
    );
  });

  it("flags duplicate keys", () => {
    const { seeds, errors } = validateSheetRows([
      makeRow({ rowNumber: 2 }),
      makeRow({ rowNumber: 3 }),
    ]);

    expect(seeds).toHaveLength(1);
    expect(errors).toHaveLength(1);
    expect(errors[0].messages[0]).toContain("Duplicate 'key'");
  });

  it("derives sortOrder from row order when no 'order' column is given", () => {
    const { seeds } = validateSheetRows([
      makeRow({ key: "t1", rowNumber: 2 }),
      makeRow({ key: "t2", rowNumber: 3 }),
    ]);

    expect(seeds.map((seed) => seed.sortOrder)).toEqual([0, 1]);
  });
});

describe("buildSyncPlan", () => {
  it("classifies inserts, updates, unchanged, and deactivations", () => {
    const seeds = [
      makeSeed({ key: "keep-same" }),
      makeSeed({ key: "changed", title: "New title" }),
      makeSeed({ key: "brand-new" }),
    ];
    const existing = [
      makeExisting({ key: "keep-same" }),
      makeExisting({ key: "changed", title: "Old title" }),
      makeExisting({ key: "gone", isActive: true }),
    ];

    const plan = buildSyncPlan(seeds, existing);

    expect(plan.toInsert.map((seed) => seed.key)).toEqual(["brand-new"]);
    expect(plan.toUpdate.map((seed) => seed.key)).toEqual(["changed"]);
    expect(plan.unchanged).toBe(1);
    expect(plan.toDeactivate).toEqual(["gone"]);
    expect(plan.toPrune).toEqual(["gone"]);
  });

  it("does not re-deactivate already-inactive missing prompts", () => {
    const existing = [makeExisting({ key: "gone", isActive: false })];
    const plan = buildSyncPlan([], existing);

    expect(plan.toDeactivate).toEqual([]);
    expect(plan.toPrune).toEqual(["gone"]);
  });

  it("detects tag-only changes as updates", () => {
    const seeds = [makeSeed({ key: "t1", tags: ["a", "b"] })];
    const existing = [makeExisting({ key: "t1", tags: ["a"] })];

    const plan = buildSyncPlan(seeds, existing);

    expect(plan.toUpdate.map((seed) => seed.key)).toEqual(["t1"]);
  });
});
