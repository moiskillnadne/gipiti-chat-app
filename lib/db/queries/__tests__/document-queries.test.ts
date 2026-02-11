import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetMock, setError, setResult } from "./db-mock";

vi.mock("../connection", async () => {
  const mod = await import("./db-mock");
  return { db: mod.mockDb };
});

import {
  deleteDocumentsByIdAfterTimestamp,
  getDocumentById,
  getDocumentsById,
  getGenerationIdByDocumentId,
  getSuggestionsByDocumentId,
  saveDocument,
  saveSuggestions,
} from "../document-queries";
import { ChatSDKError } from "../../../errors";

const DB_ERROR = new Error("connection lost");

describe("document-queries", () => {
  beforeEach(() => {
    resetMock();
  });

  // ── saveDocument ──────────────────────────────────────────────────

  describe("saveDocument", () => {
    it("inserts and returns document", async () => {
      const mockDoc = [
        {
          id: "d1",
          title: "Doc",
          kind: "text",
          content: "hello",
          userId: "u1",
        },
      ];
      setResult(mockDoc);
      const result = await saveDocument({
        id: "d1",
        title: "Doc",
        kind: "text",
        content: "hello",
        userId: "u1",
      });
      expect(result).toEqual(mockDoc);
    });

    it("defaults generationId to null", async () => {
      setResult([{ id: "d1", generationId: null }]);
      const result = await saveDocument({
        id: "d1",
        title: "Doc",
        kind: "code",
        content: "code",
        userId: "u1",
      });
      expect(result).toEqual([{ id: "d1", generationId: null }]);
    });

    it("passes generationId when provided", async () => {
      setResult([{ id: "d1", generationId: "gen-1" }]);
      const result = await saveDocument({
        id: "d1",
        title: "Doc",
        kind: "text",
        content: "hello",
        userId: "u1",
        generationId: "gen-1",
      });
      expect(result).toEqual([{ id: "d1", generationId: "gen-1" }]);
    });

    it("throws ChatSDKError on database error", async () => {
      setError(DB_ERROR);
      await expect(
        saveDocument({
          id: "d1",
          title: "Doc",
          kind: "text",
          content: "",
          userId: "u1",
        }),
      ).rejects.toMatchObject({ type: "bad_request", surface: "database" });
    });
  });

  // ── getDocumentsById ──────────────────────────────────────────────

  describe("getDocumentsById", () => {
    it("returns all document versions", async () => {
      const docs = [{ id: "d1", createdAt: new Date() }];
      setResult(docs);
      const result = await getDocumentsById({ id: "d1" });
      expect(result).toEqual(docs);
    });

    it("throws ChatSDKError on database error", async () => {
      setError(DB_ERROR);
      await expect(getDocumentsById({ id: "d1" })).rejects.toMatchObject({
        type: "bad_request",
        surface: "database",
      });
    });
  });

  // ── getDocumentById ───────────────────────────────────────────────

  describe("getDocumentById", () => {
    it("returns latest document version", async () => {
      const doc = { id: "d1", title: "Latest" };
      setResult([doc]);
      const result = await getDocumentById({ id: "d1" });
      expect(result).toEqual(doc);
    });

    it("returns undefined when not found", async () => {
      setResult([]);
      const result = await getDocumentById({ id: "nonexistent" });
      expect(result).toBeUndefined();
    });

    it("throws ChatSDKError on database error", async () => {
      setError(DB_ERROR);
      await expect(getDocumentById({ id: "d1" })).rejects.toMatchObject({
        type: "bad_request",
        surface: "database",
      });
    });
  });

  // ── getGenerationIdByDocumentId ───────────────────────────────────

  describe("getGenerationIdByDocumentId", () => {
    it("returns generationId when document has one", async () => {
      setResult([{ generationId: "gen-abc" }]);
      const result = await getGenerationIdByDocumentId({ id: "d1" });
      expect(result).toBe("gen-abc");
    });

    it("returns null when document has no generationId", async () => {
      setResult([{ generationId: null }]);
      const result = await getGenerationIdByDocumentId({ id: "d1" });
      expect(result).toBeNull();
    });

    it("returns null when document is not found", async () => {
      setResult([]);
      const result = await getGenerationIdByDocumentId({
        id: "nonexistent",
      });
      expect(result).toBeNull();
    });

    it("throws ChatSDKError on database error", async () => {
      setError(DB_ERROR);
      await expect(
        getGenerationIdByDocumentId({ id: "d1" }),
      ).rejects.toMatchObject({ type: "bad_request", surface: "database" });
    });
  });

  // ── deleteDocumentsByIdAfterTimestamp ──────────────────────────────

  describe("deleteDocumentsByIdAfterTimestamp", () => {
    it("cascading deletes suggestions and documents", async () => {
      const deleted = [{ id: "d1" }];
      setResult(deleted);
      const result = await deleteDocumentsByIdAfterTimestamp({
        id: "d1",
        timestamp: new Date("2024-01-01"),
      });
      expect(result).toEqual(deleted);
    });

    it("throws ChatSDKError on database error", async () => {
      setError(DB_ERROR);
      await expect(
        deleteDocumentsByIdAfterTimestamp({
          id: "d1",
          timestamp: new Date(),
        }),
      ).rejects.toMatchObject({ type: "bad_request", surface: "database" });
    });
  });

  // ── saveSuggestions ───────────────────────────────────────────────

  describe("saveSuggestions", () => {
    it("inserts suggestions", async () => {
      setResult({ rowCount: 1 });
      const result = await saveSuggestions({
        suggestions: [
          {
            id: "s1",
            documentId: "d1",
            documentCreatedAt: new Date(),
            originalText: "old",
            suggestedText: "new",
            description: null,
            isResolved: false,
            userId: "u1",
            createdAt: new Date(),
          },
        ],
      });
      expect(result).toEqual({ rowCount: 1 });
    });

    it("throws ChatSDKError on database error", async () => {
      setError(DB_ERROR);
      await expect(
        saveSuggestions({ suggestions: [] }),
      ).rejects.toMatchObject({ type: "bad_request", surface: "database" });
    });
  });

  // ── getSuggestionsByDocumentId ─────────────────────────────────────

  describe("getSuggestionsByDocumentId", () => {
    it("returns suggestions for the document", async () => {
      const suggestions = [
        { id: "s1", documentId: "d1", originalText: "a", suggestedText: "b" },
      ];
      setResult(suggestions);
      const result = await getSuggestionsByDocumentId({ documentId: "d1" });
      expect(result).toEqual(suggestions);
    });

    it("throws ChatSDKError on database error", async () => {
      setError(DB_ERROR);
      await expect(
        getSuggestionsByDocumentId({ documentId: "d1" }),
      ).rejects.toMatchObject({ type: "bad_request", surface: "database" });
    });
  });
});
