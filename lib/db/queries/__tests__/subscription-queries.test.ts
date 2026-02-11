import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetMock, setError, setResult } from "./db-mock";

vi.mock("../connection", async () => {
  const mod = await import("./db-mock");
  return { db: mod.mockDb };
});

vi.mock("../../../subscription/billing-periods", () => ({
  calculatePeriodEnd: vi.fn(() => new Date("2024-02-01T00:00:00.000Z")),
}));

import { ChatSDKError } from "../../../errors";
import {
  createUserSubscription,
  getActiveUserSubscription,
  getSubscriptionPlanByName,
  getSubscriptionPlans,
  getUserSubscriptionWithPlan,
  saveCancellationFeedback,
} from "../subscription-queries";

const DB_ERROR = new Error("connection lost");

const mockSubscription = {
  id: "sub-1",
  userId: "u1",
  planId: "plan-1",
  billingPeriod: "monthly" as const,
  billingPeriodCount: 1,
  currentPeriodStart: new Date("2024-01-01"),
  currentPeriodEnd: new Date("2024-02-01"),
  nextBillingDate: new Date("2024-02-01"),
  status: "active" as const,
};

const mockPlan = {
  id: "plan-1",
  name: "basic_monthly",
  displayName: "Basic Monthly",
  billingPeriod: "monthly" as const,
  tokenQuota: 3_000_000,
  isActive: true,
};

describe("subscription-queries", () => {
  beforeEach(() => {
    resetMock();
  });

  // ── getActiveUserSubscription ─────────────────────────────────────

  describe("getActiveUserSubscription", () => {
    it("returns active subscription when found", async () => {
      setResult([mockSubscription]);
      const result = await getActiveUserSubscription({ userId: "u1" });
      expect(result).toEqual(mockSubscription);
    });

    it("returns null when no active subscription exists", async () => {
      setResult([]);
      const result = await getActiveUserSubscription({ userId: "u1" });
      expect(result).toBeNull();
    });

    it("throws ChatSDKError on database error", async () => {
      setError(DB_ERROR);
      await expect(
        getActiveUserSubscription({ userId: "u1" })
      ).rejects.toMatchObject({ type: "bad_request", surface: "database" });
    });
  });

  // ── getUserSubscriptionWithPlan ───────────────────────────────────

  describe("getUserSubscriptionWithPlan", () => {
    it("returns subscription joined with plan", async () => {
      const joined = {
        subscription: mockSubscription,
        plan: mockPlan,
      };
      setResult([joined]);
      const result = await getUserSubscriptionWithPlan({ userId: "u1" });
      expect(result).toEqual(joined);
    });

    it("returns null when no active subscription", async () => {
      setResult([]);
      const result = await getUserSubscriptionWithPlan({ userId: "u1" });
      expect(result).toBeNull();
    });

    it("throws ChatSDKError on database error", async () => {
      setError(DB_ERROR);
      await expect(
        getUserSubscriptionWithPlan({ userId: "u1" })
      ).rejects.toMatchObject({ type: "bad_request", surface: "database" });
    });
  });

  // ── getSubscriptionPlans ──────────────────────────────────────────

  describe("getSubscriptionPlans", () => {
    it("returns all active plans", async () => {
      setResult([mockPlan]);
      const result = await getSubscriptionPlans();
      expect(result).toEqual([mockPlan]);
    });

    it("throws ChatSDKError on database error", async () => {
      setError(DB_ERROR);
      await expect(getSubscriptionPlans()).rejects.toMatchObject({
        type: "bad_request",
        surface: "database",
      });
    });
  });

  // ── getSubscriptionPlanByName ─────────────────────────────────────

  describe("getSubscriptionPlanByName", () => {
    it("returns plan when found", async () => {
      setResult([mockPlan]);
      const result = await getSubscriptionPlanByName({
        name: "basic_monthly",
      });
      expect(result).toEqual(mockPlan);
    });

    it("returns null when plan not found", async () => {
      setResult([]);
      const result = await getSubscriptionPlanByName({
        name: "nonexistent",
      });
      expect(result).toBeNull();
    });

    it("throws ChatSDKError on database error", async () => {
      setError(DB_ERROR);
      await expect(
        getSubscriptionPlanByName({ name: "basic" })
      ).rejects.toMatchObject({ type: "bad_request", surface: "database" });
    });
  });

  // ── createUserSubscription ────────────────────────────────────────

  describe("createUserSubscription", () => {
    it("creates subscription with calculated period end", async () => {
      setResult([mockSubscription]);
      const result = await createUserSubscription({
        userId: "u1",
        planId: "plan-1",
        billingPeriod: "monthly",
      });
      expect(result).toEqual(mockSubscription);
    });

    it("accepts custom billingPeriodCount", async () => {
      setResult([{ ...mockSubscription, billingPeriodCount: 3 }]);
      const result = await createUserSubscription({
        userId: "u1",
        planId: "plan-1",
        billingPeriod: "monthly",
        billingPeriodCount: 3,
      });
      expect(result.billingPeriodCount).toBe(3);
    });

    it("throws ChatSDKError on database error", async () => {
      setError(DB_ERROR);
      await expect(
        createUserSubscription({
          userId: "u1",
          planId: "plan-1",
          billingPeriod: "monthly",
        })
      ).rejects.toMatchObject({ type: "bad_request", surface: "database" });
    });
  });

  // ── saveCancellationFeedback ──────────────────────────────────────

  describe("saveCancellationFeedback", () => {
    it("inserts cancellation feedback", async () => {
      setResult(undefined);
      await expect(
        saveCancellationFeedback({
          userId: "u1",
          subscriptionId: "sub-1",
          reasons: ["too_expensive", "not_enough_features"],
          additionalFeedback: "Needs more models",
          planName: "basic_monthly",
          billingPeriod: "monthly",
          subscriptionDurationDays: 30,
          wasTrial: false,
        })
      ).resolves.toBeUndefined();
    });

    it("handles missing optional fields", async () => {
      setResult(undefined);
      await expect(
        saveCancellationFeedback({
          userId: "u1",
          subscriptionId: "sub-1",
          reasons: ["other"],
          wasTrial: true,
        })
      ).resolves.toBeUndefined();
    });

    it("throws ChatSDKError on database error", async () => {
      setError(DB_ERROR);
      await expect(
        saveCancellationFeedback({
          userId: "u1",
          subscriptionId: "sub-1",
          reasons: [],
          wasTrial: false,
        })
      ).rejects.toMatchObject({ type: "bad_request", surface: "database" });
    });
  });
});
