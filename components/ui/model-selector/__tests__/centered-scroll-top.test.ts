import { describe, expect, it } from "vitest";

import { centeredScrollTop } from "@/components/ui/model-selector/centered-scroll-top";

describe("centeredScrollTop", () => {
  it("centres a row in the middle of a long list", () => {
    expect(
      centeredScrollTop({
        rowOffsetTop: 1000,
        rowHeight: 80,
        listHeight: 400,
        listScrollHeight: 5000,
      })
    ).toBe(840);
  });

  it("does not scroll above the top for a row near the start", () => {
    expect(
      centeredScrollTop({
        rowOffsetTop: 40,
        rowHeight: 80,
        listHeight: 400,
        listScrollHeight: 5000,
      })
    ).toBe(0);
  });

  it("does not scroll past the end for a row near the bottom", () => {
    expect(
      centeredScrollTop({
        rowOffsetTop: 4950,
        rowHeight: 50,
        listHeight: 400,
        listScrollHeight: 5000,
      })
    ).toBe(4600);
  });
});
