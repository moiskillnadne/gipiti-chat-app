import { describe, expect, it, vi } from "vitest";

import { ONBOARDING_QUIZ_KEY } from "@/lib/quiz/types";
import { getQuizDefinition } from "@/server/modules/quiz/registry";

vi.mock("server-only", () => ({}));

describe("getQuizDefinition", () => {
  it("finds a registered quiz", () => {
    // Act
    const definition = getQuizDefinition(ONBOARDING_QUIZ_KEY);

    // Assert
    expect(definition?.bonusMajorUnits).toBeGreaterThan(0);
  });

  it.each(["constructor", "toString", "hasOwnProperty", "__proto__", "nope"])(
    "finds nothing for the key %s",
    (key) => {
      // Act / Assert
      expect(getQuizDefinition(key)).toBeUndefined();
    }
  );
});
