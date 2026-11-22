import { describe, expect, it } from "vitest";

import { getTabIndexForKey } from "@/components/landing/tab-keyboard";

describe("getTabIndexForKey", () => {
  it("moves right and wraps from the last tab to the first", () => {
    expect(getTabIndexForKey("ArrowRight", 1, 6)).toBe(2);
    expect(getTabIndexForKey("ArrowRight", 5, 6)).toBe(0);
  });

  it("moves left and wraps from the first tab to the last", () => {
    expect(getTabIndexForKey("ArrowLeft", 3, 6)).toBe(2);
    expect(getTabIndexForKey("ArrowLeft", 0, 6)).toBe(5);
  });

  it("jumps to the ends on Home and End", () => {
    expect(getTabIndexForKey("Home", 4, 6)).toBe(0);
    expect(getTabIndexForKey("End", 1, 6)).toBe(5);
  });

  it("ignores other keys and an empty tab list", () => {
    expect(getTabIndexForKey("Enter", 2, 6)).toBeNull();
    expect(getTabIndexForKey("ArrowDown", 2, 6)).toBeNull();
    expect(getTabIndexForKey("ArrowRight", 0, 0)).toBeNull();
  });
});
