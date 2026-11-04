import { describe, expect, it } from "vitest";

import ru from "@/messages/ru.json" with { type: "json" };
import { CATALOG, getCatalogEntry } from "../catalog";

const SLUG = /^[a-z0-9_]+$/;

describe("catalog", () => {
  it("uses unique, tool-name-safe ids", () => {
    // Arrange
    const ids = CATALOG.map((entry) => entry.id);

    // Act
    const unique = new Set(ids);

    // Assert
    expect(unique.size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(SLUG);
    }
  });

  it("has an https server url and a non-empty allowlist for every entry", () => {
    // Arrange / Act / Assert
    for (const entry of CATALOG) {
      expect(entry.serverUrl.startsWith("https://")).toBe(true);
      expect(Object.keys(entry.tools).length).toBeGreaterThan(0);
    }
  });

  it("has a Russian label and description for every entry", () => {
    // Arrange
    const labels = ru.integrations.catalog as Record<
      string,
      { name: string; description: string }
    >;

    // Act / Assert
    for (const entry of CATALOG) {
      expect(labels[entry.id]?.name).toBeTruthy();
      expect(labels[entry.id]?.description).toBeTruthy();
    }
  });

  it("looks entries up by id", () => {
    // Arrange / Act
    const known = getCatalogEntry("deepwiki");
    const unknown = getCatalogEntry("nope");

    // Assert
    expect(known?.authType).toBe("none");
    expect(unknown).toBeUndefined();
  });
});
