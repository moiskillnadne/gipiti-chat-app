import { describe, expect, it } from "vitest";

import { chatModels } from "../../ai/models";
import { modelLandings } from "../model-landings";
import { catalogModels, catalogSections } from "../models-catalog";

const landingBySlug = new Map(
  modelLandings.map((landing) => [landing.slug, landing])
);
const sectionSlugs = new Set(catalogSections.map((section) => section.slug));
const modelById = new Map(chatModels.map((model) => [model.id, model]));

describe("model landings", () => {
  it("covers every model in the public catalog", () => {
    const landingModelIds = new Set(
      modelLandings.map((landing) => landing.modelId)
    );
    const uncovered = catalogModels
      .filter((model) => !landingModelIds.has(model.modelId))
      .map((model) => model.modelId);

    expect(uncovered).toEqual([]);
  });

  it("keeps slugs unique and distinct from category pages", () => {
    expect(landingBySlug.size).toBe(modelLandings.length);

    const collisions = modelLandings
      .filter((landing) => sectionSlugs.has(landing.slug))
      .map((landing) => landing.slug);

    expect(collisions).toEqual([]);
  });

  it("only references models that exist and are visible in the UI", () => {
    for (const landing of modelLandings) {
      const model = modelById.get(landing.modelId);

      expect(model, `unknown model id: ${landing.modelId}`).toBeDefined();
      expect(model?.showInUI, `hidden model: ${landing.modelId}`).not.toBe(
        false
      );
    }
  });

  it("matches the landing kind to the model capabilities", () => {
    for (const landing of modelLandings) {
      const capabilities = modelById.get(landing.modelId)?.capabilities;

      if (landing.kind === "image") {
        expect(
          capabilities?.imageGeneration,
          `${landing.modelId} is not an image model`
        ).toBe(true);
      }

      if (landing.kind === "video") {
        expect(
          capabilities?.videoGeneration,
          `${landing.modelId} is not a video model`
        ).toBe(true);
      }

      if (landing.kind === "text") {
        expect(
          capabilities?.imageGeneration ?? capabilities?.videoGeneration,
          `${landing.modelId} generates media, not text`
        ).toBeFalsy();
      }
    }
  });

  it("cross-links only to pages that exist, never to itself", () => {
    for (const landing of modelLandings) {
      for (const chip of landing.otherModels) {
        const slug = chip.href.replace("/models/", "");

        expect(
          landingBySlug.has(slug) || sectionSlugs.has(slug),
          `${landing.slug} links to missing page: ${chip.href}`
        ).toBe(true);
        expect(slug, `${landing.slug} links to itself`).not.toBe(landing.slug);
      }
    }
  });
});
