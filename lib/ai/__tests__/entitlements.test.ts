import { describe, expect, it } from "vitest";
import {
  deriveFreeTier,
  FREE_TIER_ENTITLEMENTS,
  getDefaultFreePlanSeed,
  getEntitlements,
} from "../entitlements";
import { chatModels, isVisibleInUI } from "../models";

describe("getEntitlements", () => {
  it("Tier 1 returns the two starter models and a 10k token bonus", () => {
    const tier1 = getEntitlements("tier_1");
    expect(tier1.tier).toBe("tier_1");
    expect(tier1.allowedModels).toEqual(["gpt-5.4-mini", "gpt-5.4-nano"]);
    expect(tier1.tokenBonus).toBe(10_000);
    expect(tier1.imageBonus).toBe(0);
    expect(tier1.videoBonus).toBe(0);
    expect(tier1.searchQuota).toBe(2);
    expect(tier1.searchDepthAllowed).toBe("basic");
  });

  it("Tier 2 cumulatively includes Tier 1 models + the 4 new IDs", () => {
    const tier1Models = new Set(getEntitlements("tier_1").allowedModels);
    const tier2 = getEntitlements("tier_2");

    for (const id of tier1Models) {
      expect(tier2.allowedModels).toContain(id);
    }
    expect(tier2.allowedModels).toContain("sonnet-4.6");
    expect(tier2.allowedModels).toContain("gemini-3.1-flash-image");
    expect(tier2.allowedModels).toContain("gemini-3.1-pro");
    expect(tier2.allowedModels).toContain("gpt-5.4");

    expect(tier2.tokenBonus).toBe(10_000);
    expect(tier2.imageBonus).toBe(1);
    expect(tier2.videoBonus).toBe(0);
  });

  it("Tier 3 includes every UI-visible chat model in the catalog", () => {
    const tier3 = getEntitlements("tier_3");
    const visibleCatalog = chatModels
      .filter((model) => isVisibleInUI(model.id))
      .map((model) => model.id);

    for (const id of visibleCatalog) {
      expect(tier3.allowedModels).toContain(id);
    }
    expect(tier3.tokenBonus).toBe(20_000);
    expect(tier3.imageBonus).toBe(2);
    expect(tier3.videoBonus).toBe(1);
  });

  it("exposes the same data via the FREE_TIER_ENTITLEMENTS record", () => {
    expect(FREE_TIER_ENTITLEMENTS.tier_1).toBe(getEntitlements("tier_1"));
    expect(FREE_TIER_ENTITLEMENTS.tier_2).toBe(getEntitlements("tier_2"));
    expect(FREE_TIER_ENTITLEMENTS.tier_3).toBe(getEntitlements("tier_3"));
  });
});

describe("deriveFreeTier", () => {
  it("fresh signup → tier_1", () => {
    expect(
      deriveFreeTier({
        emailVerified: false,
        hasCompletedOnboardingSurvey: false,
      })
    ).toBe("tier_1");
  });

  it("email verified, no survey → tier_2", () => {
    expect(
      deriveFreeTier({
        emailVerified: true,
        hasCompletedOnboardingSurvey: false,
      })
    ).toBe("tier_2");
  });

  it("email verified and survey completed → tier_3", () => {
    expect(
      deriveFreeTier({
        emailVerified: true,
        hasCompletedOnboardingSurvey: true,
      })
    ).toBe("tier_3");
  });

  it("survey without verified email is gated to tier_1 (email is the floor)", () => {
    expect(
      deriveFreeTier({
        emailVerified: false,
        hasCompletedOnboardingSurvey: true,
      })
    ).toBe("tier_1");
  });
});

describe("getDefaultFreePlanSeed", () => {
  it("seeds tokenQuota from Tier 1 tokenBonus and zero image/video caps", () => {
    const seed = getDefaultFreePlanSeed();
    const tier1 = getEntitlements("tier_1");

    expect(seed.name).toBe("free");
    expect(seed.tokenQuota).toBe(tier1.tokenBonus);
    expect(seed.features.maxImageGenerationsPerPeriod).toBe(tier1.imageBonus);
    expect(seed.features.maxVideoGenerationsPerPeriod).toBe(tier1.videoBonus);
    expect(seed.features.searchQuota).toBe(tier1.searchQuota);
    expect(seed.features.allowedModels).toEqual(tier1.allowedModels);
  });
});
