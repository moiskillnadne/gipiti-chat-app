import { describe, expect, it } from "vitest";

import { getVisibleLoadError, withFavorite } from "../favorite-cache";

describe("withFavorite", () => {
  it("adds a prompt that is not a favourite yet", () => {
    // Arrange
    const current = { items: [{ promptId: "a" }] };

    // Act
    const result = withFavorite(current, "b", true);

    // Assert
    expect(result?.items).toEqual([{ promptId: "a" }, { promptId: "b" }]);
    expect(current.items).toEqual([{ promptId: "a" }]);
  });

  it("does not duplicate a prompt that is already a favourite", () => {
    // Arrange
    const current = { items: [{ promptId: "a" }] };

    // Act
    const result = withFavorite(current, "a", true);

    // Assert
    expect(result?.items).toEqual([{ promptId: "a" }]);
  });

  it("removes only the given prompt, and removing twice changes nothing more", () => {
    // Arrange
    const current = { items: [{ promptId: "a" }, { promptId: "b" }] };

    // Act
    const once = withFavorite(current, "a", false);
    const twice = withFavorite(once, "a", false);

    // Assert
    expect(twice?.items).toEqual([{ promptId: "b" }]);
  });

  it("composes toggles of different prompts", () => {
    // Arrange
    const current = { items: [] };

    // Act
    const result = withFavorite(withFavorite(current, "a", true), "b", true);

    // Assert
    expect(result?.items).toEqual([{ promptId: "a" }, { promptId: "b" }]);
  });

  it("leaves an empty cache empty", () => {
    // Act
    const result = withFavorite(undefined, "a", true);

    // Assert
    expect(result).toBeUndefined();
  });
});

describe("getVisibleLoadError", () => {
  const failure = new Error("offline");

  it("reports the error when there is no data", () => {
    // Act / Assert
    expect(getVisibleLoadError(failure, undefined)).toBe(failure);
  });

  it("hides the error of a failed revalidation when data is loaded", () => {
    // Act / Assert
    expect(getVisibleLoadError(failure, { items: [] })).toBeUndefined();
  });

  it("reports nothing without an error", () => {
    // Act / Assert
    expect(getVisibleLoadError(undefined, undefined)).toBeUndefined();
  });
});
