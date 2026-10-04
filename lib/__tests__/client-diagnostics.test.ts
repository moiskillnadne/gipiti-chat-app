import { describe, expect, it } from "vitest";

import { detectPageTranslation, truncateStack } from "../client-diagnostics";

type FakeDocumentOptions = {
  rootClasses?: string[];
  hasFontElement?: boolean;
};

const createFakeDocument = ({
  rootClasses = [],
  hasFontElement = false,
}: FakeDocumentOptions): Document =>
  ({
    documentElement: { classList: rootClasses },
    querySelector: (selector: string) =>
      selector === "font" && hasFontElement ? {} : null,
  }) as unknown as Document;

describe("detectPageTranslation", () => {
  it("returns false for an untouched page", () => {
    const fakeDocument = createFakeDocument({ rootClasses: ["scroll-smooth"] });

    expect(detectPageTranslation(fakeDocument)).toBe(false);
  });

  it("detects Google Translate's root class", () => {
    const fakeDocument = createFakeDocument({
      rootClasses: ["scroll-smooth", "translated-ltr"],
    });

    expect(detectPageTranslation(fakeDocument)).toBe(true);
  });

  it("detects translator <font> wrappers without a root class", () => {
    const fakeDocument = createFakeDocument({ hasFontElement: true });

    expect(detectPageTranslation(fakeDocument)).toBe(true);
  });
});

describe("truncateStack", () => {
  it("keeps short stacks intact and caps long ones", () => {
    const longStack = "x".repeat(5000);

    expect(truncateStack("Error: boom")).toBe("Error: boom");
    expect(truncateStack(longStack)).toHaveLength(1500);
    expect(truncateStack(undefined)).toBeUndefined();
  });
});
