import { describe, expect, it } from "vitest";

import { isTextTruncated } from "@/lib/utils/is-text-truncated";

describe("isTextTruncated", () => {
  it("returns false when there is no element", () => {
    expect(isTextTruncated(null)).toBe(false);
  });

  it("returns false when the text fits its box", () => {
    expect(isTextTruncated({ scrollWidth: 120, clientWidth: 120 })).toBe(false);
  });

  it("returns true when the text is wider than its box", () => {
    expect(isTextTruncated({ scrollWidth: 822, clientWidth: 176 })).toBe(true);
  });
});
