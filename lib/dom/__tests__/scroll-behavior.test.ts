import { describe, expect, it } from "vitest";

import { resolveScrollBehavior } from "@/lib/dom/scroll-behavior";

describe("resolveScrollBehavior", () => {
  it("turns a smooth scroll into an instant one when motion is reduced", () => {
    expect(resolveScrollBehavior("smooth", true)).toBe("instant");
  });

  it("keeps a smooth scroll when motion is not reduced", () => {
    expect(resolveScrollBehavior("smooth", false)).toBe("smooth");
  });

  it("keeps a smooth scroll while the preference is still unknown", () => {
    expect(resolveScrollBehavior("smooth", null)).toBe("smooth");
  });

  it("leaves non-smooth behaviours unchanged under reduced motion", () => {
    expect(resolveScrollBehavior("instant", true)).toBe("instant");
    expect(resolveScrollBehavior("auto", true)).toBe("auto");
  });
});
