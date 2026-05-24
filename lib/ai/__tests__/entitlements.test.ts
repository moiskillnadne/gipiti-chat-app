import { describe, expect, it } from "vitest";
import { entitlementsByUserType } from "../entitlements";
import { chatModels } from "../models";

describe("entitlementsByUserType", () => {
  it("exposes a non-empty model list for regular users", () => {
    const { availableChatModelIds } = entitlementsByUserType.regular;
    expect(availableChatModelIds.length).toBeGreaterThan(0);
  });

  it("only references model ids that exist in the catalog", () => {
    const catalogIds = new Set(chatModels.map((model) => model.id));
    for (const id of entitlementsByUserType.regular.availableChatModelIds) {
      expect(catalogIds.has(id)).toBe(true);
    }
  });
});
