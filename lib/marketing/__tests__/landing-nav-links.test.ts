import { describe, expect, it } from "vitest";

import { landingCatalogSectionLinks } from "../landing-nav-links";
import { catalogSections } from "../models-catalog";

describe("landingCatalogSectionLinks", () => {
  it("links to every catalog section, in catalog order", () => {
    const expectedHrefs = catalogSections.map(
      (section) => `/models/${section.slug}`
    );

    const actualHrefs = landingCatalogSectionLinks.map((link) => link.href);

    expect(actualHrefs).toEqual(expectedHrefs);
  });

  it("gives every link a non-empty label", () => {
    const hasEmptyLabel = landingCatalogSectionLinks.some(
      (link) => link.label.trim() === ""
    );

    expect(hasEmptyLabel).toBe(false);
  });
});
