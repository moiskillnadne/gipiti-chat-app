import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  /** Rows returned by each `db.select()` chain, in call order. */
  selectResults: [] as unknown[][],
  updateSet: vi.fn(),
  cancelSubscription: vi.fn(),
  getSubscription: vi.fn(),
  saveCancellationFeedback: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/app/(auth)/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db/connection", () => {
  const select = () => ({
    from: () => ({
      where: () => ({
        limit: () => Promise.resolve(mocks.selectResults.shift() ?? []),
      }),
    }),
  });
  const update = () => ({
    set: (values: Record<string, unknown>) => {
      mocks.updateSet(values);
      return { where: () => Promise.resolve() };
    },
  });

  return { db: { select, update } };
});
vi.mock("@/lib/billing/balance", () => ({ getBalance: vi.fn() }));
vi.mock("@/lib/billing/subscriptions", () => ({
  getActiveUserSubscription: vi.fn(),
}));
vi.mock("@/lib/db/query/subscription/save-cancellation-feedback", () => ({
  saveCancellationFeedback: mocks.saveCancellationFeedback,
}));
vi.mock("@/lib/payments/cloudpayments", () => ({
  cancelSubscription: mocks.cancelSubscription,
  getSubscription: mocks.getSubscription,
}));

import { DELETE } from "@/app/(chat)/api/subscription/route";

const USER_ID = "user-1";
const EXTERNAL_SUBSCRIPTION_ID = "sc_external_1";

const ACTIVE_SUBSCRIPTION = {
  id: "user-subscription-1",
  userId: USER_ID,
  subscriptionId: "catalog-1",
  status: "active",
  externalSubscriptionId: EXTERNAL_SUBSCRIPTION_ID,
  createdAt: new Date("2026-10-01T00:00:00Z"),
};

const CATALOG_ENTRY = { code: "pro", billingPeriod: "monthly" };

const cancelRequest = (body?: unknown): Request =>
  new Request("http://localhost/api/subscription", {
    method: "DELETE",
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

const givenActiveSubscription = (
  overrides:
    | Partial<typeof ACTIVE_SUBSCRIPTION>
    | { externalSubscriptionId: null } = {}
): void => {
  mocks.selectResults.push(
    [{ ...ACTIVE_SUBSCRIPTION, ...overrides }],
    [CATALOG_ENTRY]
  );
};

describe("DELETE /api/subscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.selectResults.length = 0;
    mocks.auth.mockResolvedValue({ user: { id: USER_ID } });
    mocks.cancelSubscription.mockResolvedValue({ Success: true });
    mocks.getSubscription.mockResolvedValue({
      Success: true,
      Model: { Status: "Cancelled" },
    });
    vi.spyOn(console, "error").mockReturnValue(undefined);
    vi.spyOn(console, "log").mockReturnValue(undefined);
  });

  it("returns 401 without a session", async () => {
    // Arrange
    mocks.auth.mockResolvedValue(null);

    // Act
    const response = await DELETE(cancelRequest());

    // Assert
    expect(response.status).toBe(401);
    expect(mocks.cancelSubscription).not.toHaveBeenCalled();
    expect(mocks.updateSet).not.toHaveBeenCalled();
  });

  it("returns 404 when the user has no active subscription", async () => {
    // Arrange
    mocks.selectResults.push([]);

    // Act
    const response = await DELETE(cancelRequest());

    // Assert
    expect(response.status).toBe(404);
    expect(mocks.updateSet).not.toHaveBeenCalled();
  });

  it("returns 502 and cancels nothing locally when the provider call throws", async () => {
    // Arrange
    givenActiveSubscription();
    mocks.cancelSubscription.mockRejectedValue(
      new Error("CloudPayments API error: 503")
    );

    // Act
    const response = await DELETE(
      cancelRequest({ feedback: { reasons: ["too_expensive"] } })
    );

    // Assert
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "payment_provider_error" });
    expect(mocks.updateSet).not.toHaveBeenCalled();
    expect(mocks.saveCancellationFeedback).not.toHaveBeenCalled();
  });

  it("returns 502 and cancels nothing locally when the status check throws", async () => {
    // Arrange
    givenActiveSubscription();
    mocks.getSubscription.mockRejectedValue(new Error("network down"));

    // Act
    const response = await DELETE(cancelRequest());

    // Assert
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "payment_provider_error" });
    expect(mocks.updateSet).not.toHaveBeenCalled();
  });

  it("returns 502 and cancels nothing locally when the provider refuses", async () => {
    // Arrange
    givenActiveSubscription();
    mocks.cancelSubscription.mockResolvedValue({ Success: false });

    // Act
    const response = await DELETE(cancelRequest());

    // Assert
    expect(response.status).toBe(502);
    expect(mocks.getSubscription).not.toHaveBeenCalled();
    expect(mocks.updateSet).not.toHaveBeenCalled();
  });

  it("returns 502 when the provider does not confirm the cancellation", async () => {
    // Arrange
    givenActiveSubscription();
    mocks.getSubscription.mockResolvedValue({
      Success: true,
      Model: { Status: "Active" },
    });

    // Act
    const response = await DELETE(cancelRequest());

    // Assert
    expect(response.status).toBe(502);
    expect(mocks.updateSet).not.toHaveBeenCalled();
  });

  it("marks the subscription cancelled at period end once the provider confirms", async () => {
    // Arrange
    givenActiveSubscription();

    // Act
    const response = await DELETE(cancelRequest());

    // Assert
    expect(response.status).toBe(200);
    expect(mocks.cancelSubscription).toHaveBeenCalledWith(
      EXTERNAL_SUBSCRIPTION_ID
    );
    expect(mocks.updateSet).toHaveBeenCalledTimes(1);
    expect(mocks.updateSet).toHaveBeenCalledWith({
      cancelAtPeriodEnd: true,
      cancelledAt: expect.any(Date),
    });
  });

  it("cancels locally without calling the provider when there is no provider subscription", async () => {
    // Arrange
    givenActiveSubscription({ externalSubscriptionId: null });

    // Act
    const response = await DELETE(cancelRequest());

    // Assert
    expect(response.status).toBe(200);
    expect(mocks.cancelSubscription).not.toHaveBeenCalled();
    expect(mocks.updateSet).toHaveBeenCalledTimes(1);
  });

  it("saves the feedback of a successful cancellation", async () => {
    // Arrange
    givenActiveSubscription();

    // Act
    const response = await DELETE(
      cancelRequest({
        feedback: { reasons: [], additionalFeedback: "Слишком дорого" },
      })
    );

    // Assert
    expect(response.status).toBe(200);
    expect(mocks.saveCancellationFeedback).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        subscriptionId: ACTIVE_SUBSCRIPTION.id,
        additionalFeedback: "Слишком дорого",
        planName: CATALOG_ENTRY.code,
        billingPeriod: CATALOG_ENTRY.billingPeriod,
      })
    );
  });
});
