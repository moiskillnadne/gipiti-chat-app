import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetMock, setError, setResult } from "./db-mock";

vi.mock("../connection", async () => {
  const mod = await import("./db-mock");
  return { db: mod.mockDb };
});

import { ChatSDKError } from "../../../errors";
import {
  createTextStyle,
  deleteTextStyle,
  getDefaultTextStyle,
  getTextStyleById,
  getTextStylesByUserId,
  updateTextStyle,
} from "../text-style-queries";

const DB_ERROR = new Error("connection lost");

const mockStyle = {
  id: "ts1",
  userId: "u1",
  name: "Formal",
  examples: ["Dear Sir/Madam", "Best regards"],
  isDefault: false,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

describe("text-style-queries", () => {
  beforeEach(() => {
    resetMock();
  });

  // ── getTextStylesByUserId ─────────────────────────────────────────

  describe("getTextStylesByUserId", () => {
    it("returns styles for the user", async () => {
      setResult([mockStyle]);
      const result = await getTextStylesByUserId({ userId: "u1" });
      expect(result).toEqual([mockStyle]);
    });

    it("returns empty array when no styles exist", async () => {
      setResult([]);
      const result = await getTextStylesByUserId({ userId: "u1" });
      expect(result).toEqual([]);
    });

    it("throws ChatSDKError on database error", async () => {
      setError(DB_ERROR);
      await expect(
        getTextStylesByUserId({ userId: "u1" })
      ).rejects.toMatchObject({ type: "bad_request", surface: "database" });
    });
  });

  // ── getTextStyleById ──────────────────────────────────────────────

  describe("getTextStyleById", () => {
    it("returns style when found", async () => {
      setResult([mockStyle]);
      const result = await getTextStyleById({ id: "ts1" });
      expect(result).toEqual(mockStyle);
    });

    it("returns undefined when not found", async () => {
      setResult([]);
      const result = await getTextStyleById({ id: "nonexistent" });
      expect(result).toBeUndefined();
    });

    it("throws ChatSDKError on database error", async () => {
      setError(DB_ERROR);
      await expect(getTextStyleById({ id: "ts1" })).rejects.toMatchObject({
        type: "bad_request",
        surface: "database",
      });
    });
  });

  // ── createTextStyle ───────────────────────────────────────────────

  describe("createTextStyle", () => {
    it("creates style and returns it", async () => {
      setResult([mockStyle]);
      const result = await createTextStyle({
        userId: "u1",
        name: "Formal",
        examples: ["Dear Sir/Madam"],
      });
      expect(result).toEqual(mockStyle);
    });

    it("creates style with default flag", async () => {
      const defaultStyle = { ...mockStyle, isDefault: true };
      setResult([defaultStyle]);
      const result = await createTextStyle({
        userId: "u1",
        name: "Default Style",
        isDefault: true,
      });
      expect(result.isDefault).toBe(true);
    });

    it("uses empty examples by default", async () => {
      setResult([{ ...mockStyle, examples: [] }]);
      const result = await createTextStyle({
        userId: "u1",
        name: "Minimal",
      });
      expect(result.examples).toEqual([]);
    });

    it("throws ChatSDKError on database error", async () => {
      setError(DB_ERROR);
      await expect(
        createTextStyle({ userId: "u1", name: "Fail" })
      ).rejects.toMatchObject({ type: "bad_request", surface: "database" });
    });
  });

  // ── updateTextStyle ───────────────────────────────────────────────

  describe("updateTextStyle", () => {
    it("updates name only", async () => {
      const updated = { ...mockStyle, name: "Casual" };
      setResult([updated]);
      const result = await updateTextStyle({
        id: "ts1",
        userId: "u1",
        name: "Casual",
      });
      expect(result.name).toBe("Casual");
    });

    it("updates examples", async () => {
      const updated = { ...mockStyle, examples: ["Hey!", "Cheers"] };
      setResult([updated]);
      const result = await updateTextStyle({
        id: "ts1",
        userId: "u1",
        examples: ["Hey!", "Cheers"],
      });
      expect(result.examples).toEqual(["Hey!", "Cheers"]);
    });

    it("sets isDefault and clears other defaults", async () => {
      const updated = { ...mockStyle, isDefault: true };
      setResult([updated]);
      const result = await updateTextStyle({
        id: "ts1",
        userId: "u1",
        isDefault: true,
      });
      expect(result.isDefault).toBe(true);
    });

    it("throws ChatSDKError on database error", async () => {
      setError(DB_ERROR);
      await expect(
        updateTextStyle({ id: "ts1", userId: "u1", name: "Fail" })
      ).rejects.toMatchObject({ type: "bad_request", surface: "database" });
    });
  });

  // ── deleteTextStyle ───────────────────────────────────────────────

  describe("deleteTextStyle", () => {
    it("deletes style by id and userId", async () => {
      setResult(undefined);
      await expect(
        deleteTextStyle({ id: "ts1", userId: "u1" })
      ).resolves.toBeUndefined();
    });

    it("throws ChatSDKError on database error", async () => {
      setError(DB_ERROR);
      await expect(
        deleteTextStyle({ id: "ts1", userId: "u1" })
      ).rejects.toMatchObject({ type: "bad_request", surface: "database" });
    });
  });

  // ── getDefaultTextStyle ───────────────────────────────────────────

  describe("getDefaultTextStyle", () => {
    it("returns default style when found", async () => {
      const defaultStyle = { ...mockStyle, isDefault: true };
      setResult([defaultStyle]);
      const result = await getDefaultTextStyle({ userId: "u1" });
      expect(result).toEqual(defaultStyle);
    });

    it("returns undefined when no default exists", async () => {
      setResult([]);
      const result = await getDefaultTextStyle({ userId: "u1" });
      expect(result).toBeUndefined();
    });

    it("throws ChatSDKError on database error", async () => {
      setError(DB_ERROR);
      await expect(getDefaultTextStyle({ userId: "u1" })).rejects.toMatchObject(
        { type: "bad_request", surface: "database" }
      );
    });
  });
});
