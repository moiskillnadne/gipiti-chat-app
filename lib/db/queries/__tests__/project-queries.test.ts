import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetMock, setError, setResult } from "./db-mock";

vi.mock("../connection", async () => {
  const mod = await import("./db-mock");
  return { db: mod.mockDb };
});

import {
  createProject,
  deleteProject,
  getDefaultProject,
  getProjectById,
  getProjectsByUserId,
  updateProject,
} from "../project-queries";
import { ChatSDKError } from "../../../errors";

const DB_ERROR = new Error("connection lost");

const mockProject = {
  id: "p1",
  userId: "u1",
  name: "My Project",
  contextEntries: ["entry1"],
  isDefault: false,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

describe("project-queries", () => {
  beforeEach(() => {
    resetMock();
  });

  // ── getProjectsByUserId ───────────────────────────────────────────

  describe("getProjectsByUserId", () => {
    it("returns projects for the user", async () => {
      setResult([mockProject]);
      const result = await getProjectsByUserId({ userId: "u1" });
      expect(result).toEqual([mockProject]);
    });

    it("returns empty array when no projects exist", async () => {
      setResult([]);
      const result = await getProjectsByUserId({ userId: "u1" });
      expect(result).toEqual([]);
    });

    it("throws ChatSDKError on database error", async () => {
      setError(DB_ERROR);
      await expect(
        getProjectsByUserId({ userId: "u1" }),
      ).rejects.toMatchObject({ type: "bad_request", surface: "database" });
    });
  });

  // ── getProjectById ────────────────────────────────────────────────

  describe("getProjectById", () => {
    it("returns project when found", async () => {
      setResult([mockProject]);
      const result = await getProjectById({ id: "p1" });
      expect(result).toEqual(mockProject);
    });

    it("returns undefined when not found", async () => {
      setResult([]);
      const result = await getProjectById({ id: "nonexistent" });
      expect(result).toBeUndefined();
    });

    it("throws ChatSDKError on database error", async () => {
      setError(DB_ERROR);
      await expect(getProjectById({ id: "p1" })).rejects.toMatchObject({
        type: "bad_request",
        surface: "database",
      });
    });
  });

  // ── createProject ─────────────────────────────────────────────────

  describe("createProject", () => {
    it("creates project and returns it", async () => {
      setResult([mockProject]);
      const result = await createProject({
        userId: "u1",
        name: "My Project",
        contextEntries: ["entry1"],
      });
      expect(result).toEqual(mockProject);
    });

    it("creates project with default flag", async () => {
      const defaultProject = { ...mockProject, isDefault: true };
      setResult([defaultProject]);
      const result = await createProject({
        userId: "u1",
        name: "Default",
        isDefault: true,
      });
      expect(result.isDefault).toBe(true);
    });

    it("uses empty contextEntries by default", async () => {
      setResult([{ ...mockProject, contextEntries: [] }]);
      const result = await createProject({ userId: "u1", name: "Minimal" });
      expect(result.contextEntries).toEqual([]);
    });

    it("throws ChatSDKError on database error", async () => {
      setError(DB_ERROR);
      await expect(
        createProject({ userId: "u1", name: "Fail" }),
      ).rejects.toMatchObject({ type: "bad_request", surface: "database" });
    });
  });

  // ── updateProject ─────────────────────────────────────────────────

  describe("updateProject", () => {
    it("updates name only", async () => {
      const updated = { ...mockProject, name: "Renamed" };
      setResult([updated]);
      const result = await updateProject({
        id: "p1",
        userId: "u1",
        name: "Renamed",
      });
      expect(result.name).toBe("Renamed");
    });

    it("updates contextEntries", async () => {
      const updated = { ...mockProject, contextEntries: ["new"] };
      setResult([updated]);
      const result = await updateProject({
        id: "p1",
        userId: "u1",
        contextEntries: ["new"],
      });
      expect(result.contextEntries).toEqual(["new"]);
    });

    it("sets isDefault and clears other defaults", async () => {
      const updated = { ...mockProject, isDefault: true };
      setResult([updated]);
      const result = await updateProject({
        id: "p1",
        userId: "u1",
        isDefault: true,
      });
      expect(result.isDefault).toBe(true);
    });

    it("throws ChatSDKError on database error", async () => {
      setError(DB_ERROR);
      await expect(
        updateProject({ id: "p1", userId: "u1", name: "Fail" }),
      ).rejects.toMatchObject({ type: "bad_request", surface: "database" });
    });
  });

  // ── deleteProject ─────────────────────────────────────────────────

  describe("deleteProject", () => {
    it("deletes project by id and userId", async () => {
      setResult(undefined);
      await expect(
        deleteProject({ id: "p1", userId: "u1" }),
      ).resolves.toBeUndefined();
    });

    it("throws ChatSDKError on database error", async () => {
      setError(DB_ERROR);
      await expect(
        deleteProject({ id: "p1", userId: "u1" }),
      ).rejects.toMatchObject({ type: "bad_request", surface: "database" });
    });
  });

  // ── getDefaultProject ─────────────────────────────────────────────

  describe("getDefaultProject", () => {
    it("returns default project when found", async () => {
      const defaultProject = { ...mockProject, isDefault: true };
      setResult([defaultProject]);
      const result = await getDefaultProject({ userId: "u1" });
      expect(result).toEqual(defaultProject);
    });

    it("returns undefined when no default exists", async () => {
      setResult([]);
      const result = await getDefaultProject({ userId: "u1" });
      expect(result).toBeUndefined();
    });

    it("throws ChatSDKError on database error", async () => {
      setError(DB_ERROR);
      await expect(
        getDefaultProject({ userId: "u1" }),
      ).rejects.toMatchObject({ type: "bad_request", surface: "database" });
    });
  });
});
