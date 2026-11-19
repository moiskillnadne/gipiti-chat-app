import { describe, expect, it, vi } from "vitest";

// The route and the subscription helpers pull in the auth chain, the database
// client and the CloudPayments client. None of them is exercised here: the
// tests only look at what the modules export.
vi.mock("server-only", () => ({}));
vi.mock("@/app/(auth)/auth", () => ({ auth: vi.fn() }));
vi.mock("@/server/db/connection", () => ({ db: {} }));
vi.mock("@/lib/billing/balance", () => ({
  getBalance: vi.fn(),
  ensureBalance: vi.fn(),
  resetSubscriptionPool: vi.fn(),
}));
vi.mock("@/lib/billing/subscriptions", () => ({
  getActiveUserSubscription: vi.fn(),
}));
vi.mock("@/lib/db/query/subscription/save-cancellation-feedback", () => ({
  saveCancellationFeedback: vi.fn(),
}));
vi.mock("@/lib/payments/cloudpayments", () => ({
  cancelSubscription: vi.fn(),
  getSubscription: vi.fn(),
}));

describe("/api/subscription", () => {
  // A subscription becomes active only through the CloudPayments `pay`
  // webhook, so this route must not grow a POST handler (GIPITI-119).
  it("exposes no POST handler: activation goes through the payment webhook", async () => {
    const subscriptionRoute = await import("../route");

    expect(Object.keys(subscriptionRoute)).not.toContain("POST");
  });

  // Nothing read the GET handler; the balance and the plan are read through
  // their own endpoints.
  it("exposes only the cancel handler", async () => {
    const subscriptionRoute = await import("../route");

    expect(Object.keys(subscriptionRoute)).toEqual(["DELETE"]);
  });
});

describe("subscription-init", () => {
  it("exports no helper that activates a plan outside the payment flow", async () => {
    const subscriptionInit = await import(
      "@/lib/subscription/subscription-init"
    );

    expect(Object.keys(subscriptionInit)).not.toContain("upgradeToPlan");
    expect(Object.keys(subscriptionInit)).toContain("assignFreePlan");
  });
});
