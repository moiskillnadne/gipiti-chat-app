import { describe, expect, it } from "vitest";

import { isLandingSectionLink } from "../landing-links";

describe("isLandingSectionLink", () => {
  it.each(["/", "/#features", "/#pricing"])(
    "treats %s as the landing page",
    (href) => {
      expect(isLandingSectionLink(href)).toBe(true);
    }
  );

  it.each(["/models", "/blog", "/login", "/legal/offer", "#pricing"])(
    "leaves %s eligible for prefetch",
    (href) => {
      expect(isLandingSectionLink(href)).toBe(false);
    }
  );
});
