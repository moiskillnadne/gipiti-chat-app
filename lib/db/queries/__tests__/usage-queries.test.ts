import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetMock, setError, setResult } from "./db-mock";

vi.mock("../connection", async () => {
  const mod = await import("./db-mock");
  return { db: mod.mockDb };
});

import {
  getImageGenerationCountByBillingPeriod,
  getSearchUsageCountByBillingPeriod,
  getSearchUsageCountByDateRange,
  insertImageGenerationUsageLog,
  insertSearchUsageLog,
} from "../usage-queries";

const DB_ERROR = new Error("connection lost");

const periodStart = new Date("2024-01-01");
const periodEnd = new Date("2024-02-01");

describe("usage-queries", () => {
  beforeEach(() => {
    resetMock();
  });

  // ── getSearchUsageCountByDateRange ────────────────────────────────

  describe("getSearchUsageCountByDateRange", () => {
    it("returns search count", async () => {
      setResult([{ count: 15 }]);
      const result = await getSearchUsageCountByDateRange({
        userId: "u1",
        startDate: periodStart,
        endDate: periodEnd,
      });
      expect(result).toBe(15);
    });

    it("returns 0 when no results", async () => {
      setResult([]);
      const result = await getSearchUsageCountByDateRange({
        userId: "u1",
        startDate: periodStart,
        endDate: periodEnd,
      });
      expect(result).toBe(0);
    });

    it("throws ChatSDKError on database error", async () => {
      setError(DB_ERROR);
      await expect(
        getSearchUsageCountByDateRange({
          userId: "u1",
          startDate: periodStart,
          endDate: periodEnd,
        })
      ).rejects.toMatchObject({ type: "bad_request", surface: "database" });
    });
  });

  // ── getSearchUsageCountByBillingPeriod ────────────────────────────

  describe("getSearchUsageCountByBillingPeriod", () => {
    it("returns search count for billing period", async () => {
      setResult([{ count: 8 }]);
      const result = await getSearchUsageCountByBillingPeriod({
        userId: "u1",
        periodStart,
        periodEnd,
      });
      expect(result).toBe(8);
    });

    it("returns 0 when no results", async () => {
      setResult([]);
      const result = await getSearchUsageCountByBillingPeriod({
        userId: "u1",
        periodStart,
        periodEnd,
      });
      expect(result).toBe(0);
    });

    it("throws ChatSDKError on database error", async () => {
      setError(DB_ERROR);
      await expect(
        getSearchUsageCountByBillingPeriod({
          userId: "u1",
          periodStart,
          periodEnd,
        })
      ).rejects.toMatchObject({ type: "bad_request", surface: "database" });
    });
  });

  // ── insertSearchUsageLog ──────────────────────────────────────────

  describe("insertSearchUsageLog", () => {
    it("inserts search usage log", async () => {
      setResult(undefined);
      await expect(
        insertSearchUsageLog({
          userId: "u1",
          chatId: "c1",
          query: "test query",
          searchDepth: "basic",
          resultsCount: 10,
          responseTimeMs: 250,
          cached: false,
          billingPeriodType: "monthly",
          billingPeriodStart: periodStart,
          billingPeriodEnd: periodEnd,
        })
      ).resolves.toBeUndefined();
    });

    it("accepts null chatId", async () => {
      setResult(undefined);
      await expect(
        insertSearchUsageLog({
          userId: "u1",
          chatId: null,
          query: "test",
          searchDepth: "advanced",
          resultsCount: 5,
          responseTimeMs: 100,
          cached: true,
          billingPeriodType: "daily",
          billingPeriodStart: periodStart,
          billingPeriodEnd: periodEnd,
        })
      ).resolves.toBeUndefined();
    });

    it("throws ChatSDKError on database error", async () => {
      setError(DB_ERROR);
      await expect(
        insertSearchUsageLog({
          userId: "u1",
          chatId: null,
          query: "q",
          searchDepth: "basic",
          resultsCount: 0,
          responseTimeMs: 0,
          cached: false,
          billingPeriodType: "monthly",
          billingPeriodStart: periodStart,
          billingPeriodEnd: periodEnd,
        })
      ).rejects.toMatchObject({ type: "bad_request", surface: "database" });
    });
  });

  // ── insertImageGenerationUsageLog ─────────────────────────────────

  describe("insertImageGenerationUsageLog", () => {
    it("inserts image generation usage log", async () => {
      setResult(undefined);
      await expect(
        insertImageGenerationUsageLog({
          userId: "u1",
          chatId: "c1",
          modelId: "gpt-image-1.5",
          prompt: "a cat",
          imageUrl: "https://example.com/cat.png",
          generationId: "gen-1",
          success: true,
          promptTokens: 100,
          candidatesTokens: 200,
          thoughtsTokens: 0,
          totalTokens: 300,
          totalCostUsd: "0.005",
          billingPeriodType: "monthly",
          billingPeriodStart: periodStart,
          billingPeriodEnd: periodEnd,
        })
      ).resolves.toBeUndefined();
    });

    it("accepts null optional fields", async () => {
      setResult(undefined);
      await expect(
        insertImageGenerationUsageLog({
          userId: "u1",
          chatId: null,
          modelId: "gpt-image-1.5",
          prompt: "a dog",
          imageUrl: null,
          generationId: null,
          success: false,
          promptTokens: 50,
          candidatesTokens: 0,
          thoughtsTokens: 0,
          totalTokens: 50,
          totalCostUsd: null,
          billingPeriodType: "daily",
          billingPeriodStart: periodStart,
          billingPeriodEnd: periodEnd,
        })
      ).resolves.toBeUndefined();
    });

    it("throws ChatSDKError on database error", async () => {
      setError(DB_ERROR);
      await expect(
        insertImageGenerationUsageLog({
          userId: "u1",
          chatId: null,
          modelId: "m",
          prompt: "p",
          imageUrl: null,
          generationId: null,
          success: false,
          promptTokens: 0,
          candidatesTokens: 0,
          thoughtsTokens: 0,
          totalTokens: 0,
          totalCostUsd: null,
          billingPeriodType: "monthly",
          billingPeriodStart: periodStart,
          billingPeriodEnd: periodEnd,
        })
      ).rejects.toMatchObject({ type: "bad_request", surface: "database" });
    });
  });

  // ── getImageGenerationCountByBillingPeriod ────────────────────────

  describe("getImageGenerationCountByBillingPeriod", () => {
    it("returns count of image generations", async () => {
      setResult([{ count: 3 }]);
      const result = await getImageGenerationCountByBillingPeriod({
        userId: "u1",
        periodStart,
        periodEnd,
      });
      expect(result).toBe(3);
    });

    it("returns 0 when no generations exist", async () => {
      setResult([]);
      const result = await getImageGenerationCountByBillingPeriod({
        userId: "u1",
        periodStart,
        periodEnd,
      });
      expect(result).toBe(0);
    });

    it("throws ChatSDKError on database error", async () => {
      setError(DB_ERROR);
      await expect(
        getImageGenerationCountByBillingPeriod({
          userId: "u1",
          periodStart,
          periodEnd,
        })
      ).rejects.toMatchObject({ type: "bad_request", surface: "database" });
    });
  });
});
